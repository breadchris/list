-- List App Initial Migration
-- Creates tables for users, groups, content, and tags based on JustShare models

-- Users table (references Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups table for organizing content
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Group memberships (many-to-many users <-> groups)
CREATE TABLE IF NOT EXISTS public.group_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    UNIQUE(user_id, group_id)
);

-- Content table (text only for now)
CREATE TABLE IF NOT EXISTS public.content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL DEFAULT 'text',
    data TEXT NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    parent_content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
    reply_count INTEGER DEFAULT 0
);

-- Tags table for content organization
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT UNIQUE NOT NULL,
    color TEXT,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL
);

-- Content tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS public.content_tags (
    content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (content_id, tag_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_groups_join_code ON public.groups(join_code);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user_id ON public.group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group_id ON public.group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_content_group_id ON public.content(group_id);
CREATE INDEX IF NOT EXISTS idx_content_user_id ON public.content(user_id);
CREATE INDEX IF NOT EXISTS idx_content_created_at ON public.content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_parent_content_id ON public.content(parent_content_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON public.tags(name);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for groups
CREATE POLICY "Users can view groups they belong to" ON public.groups
    FOR SELECT USING (
        id IN (
            SELECT group_id FROM public.group_memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can create groups" ON public.groups
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Group creators can update their groups" ON public.groups
    FOR UPDATE USING (created_by = auth.uid());

-- RLS Policies for group memberships
CREATE POLICY "Users can view memberships in their groups" ON public.group_memberships
    FOR SELECT USING (
        user_id = auth.uid() OR 
        group_id IN (
            SELECT group_id FROM public.group_memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join groups" ON public.group_memberships
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups" ON public.group_memberships
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for content
CREATE POLICY "Users can view content in their groups" ON public.content
    FOR SELECT USING (
        group_id IN (
            SELECT group_id FROM public.group_memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create content in their groups" ON public.content
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        group_id IN (
            SELECT group_id FROM public.group_memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own content" ON public.content
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own content" ON public.content
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for tags
CREATE POLICY "Users can view all tags" ON public.tags
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tags" ON public.tags
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

-- RLS Policies for content_tags
CREATE POLICY "Users can view content tags for content they can see" ON public.content_tags
    FOR SELECT USING (
        content_id IN (
            SELECT id FROM public.content
            WHERE group_id IN (
                SELECT group_id FROM public.group_memberships 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can add tags to their content" ON public.content_tags
    FOR INSERT WITH CHECK (
        content_id IN (
            SELECT id FROM public.content 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can remove tags from their content" ON public.content_tags
    FOR DELETE USING (
        content_id IN (
            SELECT id FROM public.content 
            WHERE user_id = auth.uid()
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on content updates
CREATE TRIGGER trigger_update_content_updated_at
    BEFORE UPDATE ON public.content
    FOR EACH ROW
    EXECUTE FUNCTION update_content_updated_at();

-- Function to generate unique join codes
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql;

-- Grant appropriate permissions
GRANT SELECT ON public.users TO anon;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

GRANT SELECT ON public.groups TO anon;
GRANT ALL ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

GRANT ALL ON public.group_memberships TO authenticated;
GRANT ALL ON public.group_memberships TO service_role;

GRANT ALL ON public.content TO authenticated;
GRANT ALL ON public.content TO service_role;

GRANT ALL ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;

GRANT ALL ON public.content_tags TO authenticated;
GRANT ALL ON public.content_tags TO service_role;