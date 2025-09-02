-- Seed data for local development and testing
-- This file is executed when running `supabase start` or `supabase db reset`

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Insert test user into auth.users table
-- Password: testpassword123 (will be encrypted)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'test@example.com',
    crypt('testpassword123', gen_salt('bf')),
    NOW(),
    NULL,
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Insert corresponding identity
INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '{"sub": "a0000000-0000-0000-0000-000000000001", "email": "test@example.com"}',
    'email',
    NOW(),
    NOW(),
    NOW(),
    uuid_generate_v4()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Insert a second test user for registration conflict testing
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'existing@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NULL,
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Insert corresponding identity for second user
INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    '{"sub": "a0000000-0000-0000-0000-000000000002", "email": "existing@example.com"}',
    'email',
    NOW(),
    NOW(),
    NOW(),
    uuid_generate_v4()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Create user profiles in the public.users table
INSERT INTO public.users (id, username, created_at) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'test@example.com', NOW()),
    ('a0000000-0000-0000-0000-000000000002', 'existing@example.com', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create a test group
INSERT INTO public.groups (id, name, created_by, created_at, join_code) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'Test Group', 'a0000000-0000-0000-0000-000000000001', NOW(), 'TEST01')
ON CONFLICT (id) DO NOTHING;

-- Add the first test user to the test group as owner
INSERT INTO public.group_memberships (id, user_id, group_id, role, created_at) VALUES
    (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner', NOW())
ON CONFLICT (user_id, group_id) DO NOTHING;

-- Add some test content to the group
INSERT INTO public.content (id, type, data, group_id, user_id, parent_content_id, created_at, updated_at) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'text', 'Welcome to the test group!', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL, NOW(), NOW()),
    ('c0000000-0000-0000-0000-000000000002', 'text', 'This is a sample task item', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;