-- roles
CREATE TYPE public.app_role AS ENUM ('admin', 'reseller');
CREATE TYPE public.stream_kind AS ENUM ('live', 'movie', 'series');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  credits integer NOT NULL DEFAULT 0,
  parent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR parent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN (SELECT count(*) FROM public.user_roles) = 0 THEN 'admin'::public.app_role ELSE 'reseller'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- playlists
CREATE TABLE public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'url',
  source_url text,
  status text NOT NULL DEFAULT 'pending',
  total_items integer NOT NULL DEFAULT 0,
  last_import_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlists owner all" ON public.playlists FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER playlists_updated BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.owns_playlist(_playlist_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = _playlist_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
$$;

CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  processed integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO authenticated;
GRANT ALL ON public.import_jobs TO service_role;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import jobs owner" ON public.import_jobs FOR ALL TO authenticated
  USING (public.owns_playlist(playlist_id)) WITH CHECK (public.owns_playlist(playlist_id));

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind public.stream_kind NOT NULL,
  items_count integer NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, kind, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories owner" ON public.categories FOR ALL TO authenticated
  USING (public.owns_playlist(playlist_id)) WITH CHECK (public.owns_playlist(playlist_id));
CREATE INDEX idx_categories_playlist ON public.categories(playlist_id, kind);

CREATE TABLE public.streams (
  id bigserial PRIMARY KEY,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  kind public.stream_kind NOT NULL,
  name text NOT NULL,
  logo text,
  tvg_id text,
  url text NOT NULL,
  container_ext text,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streams TO authenticated;
GRANT ALL ON public.streams TO service_role;
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streams owner" ON public.streams FOR ALL TO authenticated
  USING (public.owns_playlist(playlist_id)) WITH CHECK (public.owns_playlist(playlist_id));
CREATE INDEX idx_streams_playlist ON public.streams(playlist_id, kind);
CREATE INDEX idx_streams_category ON public.streams(category_id);

CREATE TABLE public.series (
  id bigserial PRIMARY KEY,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  logo text,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT ALL ON public.series TO service_role;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "series owner" ON public.series FOR ALL TO authenticated
  USING (public.owns_playlist(playlist_id)) WITH CHECK (public.owns_playlist(playlist_id));
CREATE INDEX idx_series_playlist ON public.series(playlist_id);

CREATE TABLE public.series_episodes (
  id bigserial PRIMARY KEY,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  series_id bigint NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  season integer NOT NULL DEFAULT 1,
  episode integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  logo text,
  url text NOT NULL,
  container_ext text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series_episodes TO authenticated;
GRANT ALL ON public.series_episodes TO service_role;
ALTER TABLE public.series_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "episodes owner" ON public.series_episodes FOR ALL TO authenticated
  USING (public.owns_playlist(playlist_id)) WITH CHECK (public.owns_playlist(playlist_id));
CREATE INDEX idx_episodes_series ON public.series_episodes(series_id);

CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages owner" ON public.packages FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.package_categories (
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (package_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_categories TO authenticated;
GRANT ALL ON public.package_categories TO service_role;
ALTER TABLE public.package_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "package categories owner" ON public.package_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.packages p WHERE p.id = package_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.packages p WHERE p.id = package_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TABLE public.lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  max_connections integer NOT NULL DEFAULT 1,
  expires_at timestamptz,
  is_trial boolean NOT NULL DEFAULT false,
  banned boolean NOT NULL DEFAULT false,
  notes text,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lines TO authenticated;
GRANT ALL ON public.lines TO service_role;
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lines owner" ON public.lines FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER lines_updated BEFORE UPDATE ON public.lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.line_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
  stream_ref text,
  kind text,
  ip text,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT ON public.line_sessions TO authenticated;
GRANT ALL ON public.line_sessions TO service_role;
ALTER TABLE public.line_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions owner read" ON public.line_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lines l WHERE l.id = line_id AND (l.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE INDEX idx_sessions_line ON public.line_sessions(line_id, last_seen_at DESC);