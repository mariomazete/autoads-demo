-- Garante que a Biblioteca de Campanhas sempre tenha as marcas padrão.
-- O slug evita duplicidades caso as marcas já existam.
insert into public.brands (name, slug, active)
values
  ('Fiat', 'fiat', true),
  ('Jeep', 'jeep', true),
  ('Ford', 'ford', true),
  ('Peugeot', 'peugeot', true),
  ('Citroën', 'citroen', true),
  ('Renault', 'renault', true),
  ('GAC', 'gac', true),
  ('Geely', 'geely', true),
  ('Omoda & Jaecoo', 'omoda-jaecoo', true),
  ('Leapmotor', 'leapmotor', true)
on conflict (slug) do update
set
  name = excluded.name,
  active = true,
  updated_at = now();

-- Mantém somente marcas ativas disponíveis para usuários autenticados.
drop policy if exists "Authenticated users can view brands" on public.brands;

create policy "Authenticated users can view brands"
  on public.brands
  for select
  to authenticated
  using (active = true or public.is_master());