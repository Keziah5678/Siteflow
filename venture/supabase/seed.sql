-- =============================================================================
-- VENTURE — demonstration data (local / staging only)
-- Every project here has is_demo = true and is labelled
-- « Donnée de démonstration » in the UI. Demo accounts have no usable
-- password (encrypted_password is an invalid hash) so nobody can sign in
-- as them. Hide all demo content from admin: Paramètres → show_demo_content.
-- =============================================================================

do $$
declare
  thomas uuid := '00000000-0000-4000-8000-000000000001';
  lea uuid := '00000000-0000-4000-8000-000000000002';
  karim uuid := '00000000-0000-4000-8000-000000000003';
  festival uuid := '00000000-0000-4000-8000-0000000000f1';
  brand uuid := '00000000-0000-4000-8000-0000000000f2';
  game uuid := '00000000-0000-4000-8000-0000000000f3';
begin
  -- Token columns must be '' (not NULL): GoTrue cannot scan NULLs there.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values
    (thomas, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'thomas.demo@venture.invalid', '!demo-no-login', now(),
     '{"display_name":"Thomas (démo)","username":"thomas_demo","birthdate":"1994-05-12"}', '{"provider":"email","providers":["email"]}', now(), now(), '', '', '', '', '', '', '', ''),
    (lea, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lea.demo@venture.invalid', '!demo-no-login', now(),
     '{"display_name":"Léa (démo)","username":"lea_demo","birthdate":"1997-09-02"}', '{"provider":"email","providers":["email"]}', now(), now(), '', '', '', '', '', '', '', ''),
    (karim, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'karim.demo@venture.invalid', '!demo-no-login', now(),
     '{"display_name":"Karim (démo)","username":"karim_demo","birthdate":"1990-01-20"}', '{"provider":"email","providers":["email"]}', now(), now(), '', '', '', '', '', '', '', '')
  on conflict (id) do nothing;

  update public.profiles set
    bio = 'Profil de démonstration. Passionné de musique électronique.',
    skills = array['Organisation', 'Communication'], interests = array['Musique', 'Festivals'],
    ambitions = array['Organiser un festival'], city = 'Rennes', onboarded = true, is_discoverable = false
  where id = thomas;
  update public.profiles set
    bio = 'Profil de démonstration. Designer textile.',
    skills = array['Design', 'Couture', 'Photographie'], interests = array['Mode', 'Upcycling'],
    ambitions = array['Créer une marque'], city = 'Lyon', onboarded = true, is_discoverable = false
  where id = lea;
  update public.profiles set
    bio = 'Profil de démonstration. Développeur de jeux indépendants.',
    skills = array['Unity', 'C#', 'Game design'], interests = array['Jeux vidéo', 'Pixel art'],
    ambitions = array['Sortir un jeu sur Steam'], city = 'Paris', onboarded = true, is_discoverable = false
  where id = karim;

  insert into public.projects (id, owner_id, title, description, category, status, goal, interest_goal, skills_needed, city, lat, lng, is_demo, interest_count, cover_url)
  values (festival, thomas,
    'Créons le plus grand festival électro de Bretagne',
    'Je souhaite réunir des passionnés de musique électronique pour organiser un festival sur une plage bretonne.',
    'event', 'recruiting', 'Réunir 2 000 personnes intéressées', 2000,
    array['DJ', 'Organisateurs', 'Photographes', 'Partenaires'], 'Saint-Malo', 48.65, -2.03, true, 1842, null)
  on conflict (id) do nothing;
  update public.event_details set venue_idea = 'Plage du Sillon, Saint-Malo', capacity = 2000,
    price_min_cents = 2500, price_max_cents = 4500,
    date_options = array['2027-07-10'::date, '2027-07-17'::date]
  where project_id = festival;

  insert into public.projects (id, owner_id, title, description, category, status, goal, skills_needed, city, lat, lng, is_demo)
  values (brand, lea,
    'Lancer une marque de vêtements upcyclés',
    'Je veux créer une marque de vêtements à partir de tissus récupérés, avec une équipe qui partage les valeurs de l''économie circulaire.',
    'creation', 'preparing', 'Constituer une équipe de 4 personnes', array['Design', 'Marketing', 'Développement web', 'Photographie'],
    'Lyon', 45.76, 4.84, true)
  on conflict (id) do nothing;

  insert into public.projects (id, owner_id, title, description, category, status, goal, skills_needed, city, is_remote, is_demo)
  values (game, karim,
    'Un jeu vidéo coopératif en pixel art',
    'Je développe un jeu coopératif à deux joueurs et je cherche un artiste pixel art et un compositeur pour finaliser une démo jouable.',
    'creation', 'in_progress', 'Sortir une démo jouable', array['Pixel art', 'Composition musicale', 'Game design'],
    'Paris', true, true)
  on conflict (id) do nothing;

  insert into public.milestones (project_id, title, position, done) values
    (festival, 'Valider l''intérêt de la communauté', 0, false),
    (festival, 'Trouver un lieu et les autorisations', 1, false),
    (festival, 'Constituer le line-up', 2, false),
    (brand, 'Définir l''identité de la marque', 0, true),
    (brand, 'Produire les premiers prototypes', 1, false),
    (brand, 'Ouvrir la boutique en ligne', 2, false),
    (game, 'Prototype jouable', 0, true),
    (game, 'Direction artistique', 1, true),
    (game, 'Démo publique', 2, false);
end $$;
