ALTER TABLE public.categories ADD COLUMN seq bigserial;
CREATE UNIQUE INDEX idx_categories_seq ON public.categories(seq);