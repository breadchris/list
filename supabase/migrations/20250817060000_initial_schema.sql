-- Initial schema setup
-- Create functions first
CREATE OR REPLACE FUNCTION public.generate_join_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- Create tables
create table "public"."users" (
  "id" uuid not null default uuid_generate_v4(),
  "username" text,
  "created_at" timestamp with time zone not null default now()
);

create table "public"."groups" (
  "id" uuid not null default uuid_generate_v4(),
  "created_at" timestamp with time zone not null default now(),
  "name" text not null,
  "join_code" text not null default generate_join_code(),
  "created_by" uuid
);

create table "public"."group_memberships" (
  "id" uuid not null default uuid_generate_v4(),
  "created_at" timestamp with time zone not null default now(),
  "user_id" uuid not null,
  "group_id" uuid not null,
  "role" text not null default 'member'::text
);

create table "public"."content" (
  "id" uuid not null default uuid_generate_v4(),
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "type" text not null default 'text'::text,
  "data" text not null,
  "group_id" uuid not null,
  "user_id" uuid not null,
  "parent_content_id" uuid
);

create table "public"."tags" (
  "id" uuid not null default uuid_generate_v4(),
  "created_at" timestamp with time zone not null default now(),
  "name" text not null,
  "color" text,
  "user_id" uuid not null
);

create table "public"."content_tags" (
  "content_id" uuid not null,
  "tag_id" uuid not null,
  "created_at" timestamp with time zone not null default now()
);

-- Enable RLS
alter table "public"."users" enable row level security;
alter table "public"."groups" enable row level security;
alter table "public"."group_memberships" enable row level security;
alter table "public"."content" enable row level security;
alter table "public"."tags" enable row level security;
alter table "public"."content_tags" enable row level security;

-- Create indexes and constraints
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);
alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id);
CREATE UNIQUE INDEX groups_join_code_key ON public.groups USING btree (join_code);
CREATE INDEX idx_groups_created_by ON public.groups USING btree (created_by);
CREATE INDEX idx_groups_join_code ON public.groups USING btree (join_code);
alter table "public"."groups" add constraint "groups_pkey" PRIMARY KEY using index "groups_pkey";
alter table "public"."groups" add constraint "groups_join_code_key" UNIQUE using index "groups_join_code_key";

CREATE UNIQUE INDEX group_memberships_pkey ON public.group_memberships USING btree (id);
CREATE UNIQUE INDEX group_memberships_user_id_group_id_key ON public.group_memberships USING btree (user_id, group_id);
CREATE INDEX idx_group_memberships_group_id ON public.group_memberships USING btree (group_id);
CREATE INDEX idx_group_memberships_user_id ON public.group_memberships USING btree (user_id);
alter table "public"."group_memberships" add constraint "group_memberships_pkey" PRIMARY KEY using index "group_memberships_pkey";
alter table "public"."group_memberships" add constraint "group_memberships_user_id_group_id_key" UNIQUE using index "group_memberships_user_id_group_id_key";

CREATE UNIQUE INDEX content_pkey ON public.content USING btree (id);
CREATE INDEX idx_content_created_at ON public.content USING btree (created_at DESC);
CREATE INDEX idx_content_group_id ON public.content USING btree (group_id);
CREATE INDEX idx_content_parent_content_id ON public.content USING btree (parent_content_id);
CREATE INDEX idx_content_user_id ON public.content USING btree (user_id);
alter table "public"."content" add constraint "content_pkey" PRIMARY KEY using index "content_pkey";

CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id);
CREATE UNIQUE INDEX tags_name_user_id_key ON public.tags USING btree (name, user_id);
CREATE INDEX idx_tags_user_id ON public.tags USING btree (user_id);
alter table "public"."tags" add constraint "tags_pkey" PRIMARY KEY using index "tags_pkey";
alter table "public"."tags" add constraint "tags_name_user_id_key" UNIQUE using index "tags_name_user_id_key";

CREATE UNIQUE INDEX content_tags_pkey ON public.content_tags USING btree (content_id, tag_id);
CREATE INDEX idx_content_tags_content_id ON public.content_tags USING btree (content_id);
CREATE INDEX idx_content_tags_tag_id ON public.content_tags USING btree (tag_id);
alter table "public"."content_tags" add constraint "content_tags_pkey" PRIMARY KEY using index "content_tags_pkey";

-- Add foreign key constraints
alter table "public"."groups" add constraint "groups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
alter table "public"."group_memberships" add constraint "group_memberships_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table "public"."group_memberships" add constraint "group_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."content" add constraint "content_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table "public"."content" add constraint "content_parent_content_id_fkey" FOREIGN KEY (parent_content_id) REFERENCES content(id) ON DELETE CASCADE;
alter table "public"."content" add constraint "content_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."tags" add constraint "tags_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."content_tags" add constraint "content_tags_content_id_fkey" FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE;
alter table "public"."content_tags" add constraint "content_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

-- Create trigger
CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON public.content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
grant select, insert, update, delete on table "public"."users" to "anon", "authenticated";
grant select, insert, update, delete on table "public"."groups" to "anon", "authenticated";
grant select, insert, update, delete on table "public"."group_memberships" to "anon", "authenticated";
grant select, insert, update, delete on table "public"."content" to "anon", "authenticated";
grant select, insert, update, delete on table "public"."tags" to "anon", "authenticated";
grant select, insert, update, delete on table "public"."content_tags" to "anon", "authenticated";

-- Create RLS policies
create policy "Users are viewable by everyone"
on "public"."users"
as permissive
for select
to public
using (true);

create policy "Users can update own profile"
on "public"."users"
as permissive
for update
to public
using (((auth.uid())::text = (id)::text));

create policy "Groups are viewable by members"
on "public"."groups"
as permissive
for select
to public
using (((EXISTS ( SELECT 1
  FROM group_memberships
  WHERE ((group_memberships.group_id = groups.id) AND ((group_memberships.user_id)::text = (auth.uid())::text)))) OR (join_code IS NOT NULL)));

create policy "Group creators can update their groups"
on "public"."groups"
as permissive
for update
to public
using (((created_by)::text = (auth.uid())::text));

create policy "Group memberships are viewable by group members"
on "public"."group_memberships"
as permissive
for select
to public
using ((((user_id)::text = (auth.uid())::text) OR (EXISTS ( SELECT 1
  FROM group_memberships gm
  WHERE ((gm.group_id = group_memberships.group_id) AND ((gm.user_id)::text = (auth.uid())::text))))));

create policy "Users can join groups"
on "public"."group_memberships"
as permissive
for insert
to public
with check (((user_id)::text = (auth.uid())::text));

create policy "Content is viewable by group members"
on "public"."content"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
  FROM group_memberships
  WHERE ((group_memberships.group_id = content.group_id) AND ((group_memberships.user_id)::text = (auth.uid())::text)))));

create policy "Users can create content in their groups"
on "public"."content"
as permissive
for insert
to public
with check ((((user_id)::text = (auth.uid())::text) AND (EXISTS ( SELECT 1
  FROM group_memberships
  WHERE ((group_memberships.group_id = content.group_id) AND ((group_memberships.user_id)::text = (auth.uid())::text))))));

create policy "Users can update their own content"
on "public"."content"
as permissive
for update
to public
using (((user_id)::text = (auth.uid())::text));

create policy "Users can delete their own content"
on "public"."content"
as permissive
for delete
to public
using (((user_id)::text = (auth.uid())::text));

create policy "Users can view their own tags"
on "public"."tags"
as permissive
for select
to public
using (((user_id)::text = (auth.uid())::text));

create policy "Users can create their own tags"
on "public"."tags"
as permissive
for insert
to public
with check (((user_id)::text = (auth.uid())::text));

create policy "Users can update their own tags"
on "public"."tags"
as permissive
for update
to public
using (((user_id)::text = (auth.uid())::text));

create policy "Users can delete their own tags"
on "public"."tags"
as permissive
for delete
to public
using (((user_id)::text = (auth.uid())::text));

create policy "Content tags are viewable with content"
on "public"."content_tags"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
  FROM (content c
  JOIN group_memberships gm ON ((gm.group_id = c.group_id)))
  WHERE ((c.id = content_tags.content_id) AND ((gm.user_id)::text = (auth.uid())::text)))));

create policy "Users can tag their own content"
on "public"."content_tags"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
  FROM content c
  WHERE ((c.id = content_tags.content_id) AND ((c.user_id)::text = (auth.uid())::text)))));

create policy "Users can remove tags from their own content"
on "public"."content_tags"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
  FROM content c
  WHERE ((c.id = content_tags.content_id) AND ((c.user_id)::text = (auth.uid())::text)))));