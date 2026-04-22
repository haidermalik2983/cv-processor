create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  linkedin_url text,
  github_url text,
  title text,
  created_at timestamp default now(),
  updated_at timestamp default now(),

  constraint linkedin_url_check
    check (linkedin_url is null or linkedin_url like 'https://%linkedin.com/%'),

  constraint github_url_check
    check (github_url is null or github_url like 'https://github.com/%')
);