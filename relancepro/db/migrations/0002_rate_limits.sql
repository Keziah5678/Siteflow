-- Fixed-window rate limiting shared by every serverless instance.
create table rp.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
create index rate_limits_window_idx on rp.rate_limits(window_start);
