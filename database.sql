--
-- PostgreSQL database dump
--


-- Dumped from database version 15.12
-- Dumped by pg_dump version 15.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: prj_q4H4APNVXzn0; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "prj_q4H4APNVXzn0";


--
-- Name: prj_q4H4APNVXzn0_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "prj_q4H4APNVXzn0_auth";


--
-- Name: prj_q4H4APNVXzn0_storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "prj_q4H4APNVXzn0_storage";


--
-- Name: auth_uid(); Type: FUNCTION; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE FUNCTION "prj_q4H4APNVXzn0_auth".auth_uid() RETURNS uuid
    LANGUAGE sql
    AS $$
  SELECT current_setting('request.jwt.claim.sub', true)::uuid
$$;


--
-- Name: role(); Type: FUNCTION; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE FUNCTION "prj_q4H4APNVXzn0_auth".role() RETURNS text
    LANGUAGE sql
    AS $$
  SELECT COALESCE(current_setting('request.jwt.claim.role', true), 'anon')
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

CREATE FUNCTION "prj_q4H4APNVXzn0_storage".foldername(name text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT string_to_array(name, '/')
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: content_library; Type: TABLE; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0".content_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    content_type text NOT NULL,
    category text NOT NULL,
    level text NOT NULL,
    language text DEFAULT 'English'::text,
    url text,
    thumbnail_url text,
    duration_seconds integer,
    is_free boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: exam_bank; Type: TABLE; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0".exam_bank (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country text NOT NULL,
    exam_type text NOT NULL,
    subject text NOT NULL,
    year integer,
    level text NOT NULL,
    questions jsonb DEFAULT '[]'::jsonb NOT NULL,
    answers jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: knowledge_base; Type: TABLE; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0".knowledge_base (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    effective_date date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lesson_notes; Type: TABLE; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0".lesson_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid,
    title text NOT NULL,
    subject text NOT NULL,
    topic text NOT NULL,
    country text NOT NULL,
    region text NOT NULL,
    level text NOT NULL,
    class_name text NOT NULL,
    language text DEFAULT 'English'::text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: saved_content; Type: TABLE; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0".saved_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid,
    content_type text NOT NULL,
    content_id uuid,
    title text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: school_websites; Type: TABLE; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0".school_websites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid,
    school_name text NOT NULL,
    domain_name text,
    school_info jsonb DEFAULT '{}'::jsonb NOT NULL,
    website_content jsonb DEFAULT '{}'::jsonb,
    is_published boolean DEFAULT false,
    subscription_status text DEFAULT 'inactive'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: teachers; Type: TABLE; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0".teachers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    school_name text,
    country text DEFAULT 'Nigeria'::text NOT NULL,
    region text DEFAULT 'West Africa'::text NOT NULL,
    preferred_language text DEFAULT 'English'::text,
    subscription_plan text DEFAULT 'free'::text,
    subscription_status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    auth_id uuid,
    lesson_count integer DEFAULT 0,
    last_login timestamp with time zone
);


--
-- Name: identities; Type: TABLE; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0_auth".identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    provider text NOT NULL,
    identity_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0_auth".users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    encrypted_password text,
    email_confirmed_at timestamp with time zone,
    phone text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);


--
-- Name: buckets; Type: TABLE; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0_storage".buckets (
    id text NOT NULL,
    name text NOT NULL,
    public boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    file_size_limit bigint,
    allowed_mime_types text[]
);


--
-- Name: objects; Type: TABLE; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

CREATE TABLE "prj_q4H4APNVXzn0_storage".objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    path_tokens text[],
    version text
);


--
-- Data for Name: content_library; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0; Owner: -
--

COPY "prj_q4H4APNVXzn0".content_library (id, title, description, content_type, category, level, language, url, thumbnail_url, duration_seconds, is_free, created_at) FROM stdin;
e9cf05dc-8502-438d-b54b-3ef5190a68cb	ABC Alphabet Song	Learn the alphabet with this fun sing-along	audio	Literacy	nursery	English	\N	\N	204	t	2026-02-07 00:24:11.91276+00
5467fdde-90e1-49f8-b103-e65fe854e872	Counting 1-100	Interactive video teaching numbers	video	Mathematics	nursery	English	\N	\N	495	t	2026-02-07 00:24:11.91276+00
93551fe4-1f67-45b1-a71f-dc43d29d1485	Shapes & Colors Match	Fun matching game for shapes and colors	game	Mathematics	preschool	English	\N	\N	900	t	2026-02-07 00:24:11.91276+00
a4438b93-8594-4e5b-bec5-0109667b597c	Bible Stories for Kids	Animated Bible stories collection	video	Christian Education	nursery	English	\N	\N	750	t	2026-02-07 00:24:11.91276+00
96432e31-170a-46a1-b54e-85c486ac2fd3	Basic Science: Plants	Learn about plant parts and growth	video	Science	primary	English	\N	\N	645	t	2026-02-07 00:24:11.91276+00
f562bf9a-3cec-43fc-b498-f43a7cb636f2	French for Beginners	Basic French vocabulary and phrases	audio	French	primary	French	\N	\N	900	f	2026-02-07 00:24:11.91276+00
4934779f-9191-43d2-a93d-280f1ac371b1	Word Puzzle Adventure	Spelling and vocabulary game	game	English	primary	English	\N	\N	1200	t	2026-02-07 00:24:11.91276+00
706a8138-7c16-4ee8-959b-ddce7cad6b2e	The Creation Story	Interactive creation story for young learners	video	Christian Education	preschool	English	\N	\N	440	t	2026-02-07 00:24:11.91276+00
\.


--
-- Data for Name: exam_bank; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0; Owner: -
--

COPY "prj_q4H4APNVXzn0".exam_bank (id, country, exam_type, subject, year, level, questions, answers, created_at) FROM stdin;
35b40dce-8f9e-4268-b4b6-1b36a1fbae14	Nigeria	first_school	Mathematics	2024	Primary 6	[{"q": "What is 456 + 789?", "answer": 0, "options": ["1245", "1235", "1345", "1145"]}]	["1245"]	2026-02-07 00:24:11.91276+00
e484413b-7f51-4967-ac4b-89b3188e9d5b	Nigeria	common_entrance	English Language	2024	Primary 5-6	[{"q": "Choose the correct spelling", "answer": 1, "options": ["Recieve", "Receive", "Receve", "Receeve"]}]	["Receive"]	2026-02-07 00:24:11.91276+00
a2904567-d5a2-456f-87dc-95314832e09b	Ghana	first_school	Mathematics	2023	Primary 6	[{"q": "Simplify 3/4 + 1/2", "answer": 1, "options": ["5/4", "1 1/4", "4/6", "1/2"]}]	["1 1/4"]	2026-02-07 00:24:11.91276+00
89ebbcb4-2010-43e5-a589-ebd6eb9fef83	Kenya	first_school	Science	2023	Grade 6	[{"q": "Which planet is closest to the sun?", "answer": 2, "options": ["Venus", "Earth", "Mercury", "Mars"]}]	["Mercury"]	2026-02-07 00:24:11.91276+00
\.


--
-- Data for Name: knowledge_base; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0; Owner: -
--

COPY "prj_q4H4APNVXzn0".knowledge_base (id, country, category, title, content, effective_date, is_active, created_at) FROM stdin;
a1f7cc37-2701-4373-97f6-e95b76352961	Nigeria	Curriculum Update	NERDC 2025 Revised Primary Curriculum	Updated primary curriculum includes digital literacy from Primary 3	2025-12-15	t	2026-02-07 00:24:11.91276+00
731eec46-0755-4c8f-ba75-d5bc9e8f34a1	Ghana	Pedagogy	NaCCA Activity-Based Learning	New guidelines emphasize 60% student-led activities	2025-11-20	t	2026-02-07 00:24:11.91276+00
d99c2089-62c0-4f56-b16b-948c8f2703a4	Kenya	Assessment	CBC Formative Assessment Framework	Portfolio-based assessment alongside traditional testing	2025-10-05	t	2026-02-07 00:24:11.91276+00
a1f63bf8-ea27-4e30-aaeb-62eca5fc2819	South Africa	Curriculum Update	CAPS Indigenous Knowledge Integration	Mandates integration of indigenous knowledge systems	2025-09-18	t	2026-02-07 00:24:11.91276+00
\.


--
-- Data for Name: lesson_notes; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0; Owner: -
--

COPY "prj_q4H4APNVXzn0".lesson_notes (id, teacher_id, title, subject, topic, country, region, level, class_name, language, content, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: saved_content; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0; Owner: -
--

COPY "prj_q4H4APNVXzn0".saved_content (id, teacher_id, content_type, content_id, title, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: school_websites; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0; Owner: -
--

COPY "prj_q4H4APNVXzn0".school_websites (id, teacher_id, school_name, domain_name, school_info, website_content, is_published, subscription_status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: teachers; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0; Owner: -
--

COPY "prj_q4H4APNVXzn0".teachers (id, email, full_name, school_name, country, region, preferred_language, subscription_plan, subscription_status, created_at, updated_at, auth_id, lesson_count, last_login) FROM stdin;
e5999e3a-4f40-483f-910c-42c67e106cac	tchamer@aol.com	james Meyembi	Quinchama	Cameroon	Central Africa	English	free	active	2026-02-09 00:35:57.686006+00	2026-02-09 00:35:57.686006+00	a9e96b5f-6e21-4018-ac6c-2249bc3be1d4	0	2026-04-09 21:55:57.573+00
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

COPY "prj_q4H4APNVXzn0_auth".identities (id, user_id, provider, identity_data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

COPY "prj_q4H4APNVXzn0_auth".users (id, email, encrypted_password, email_confirmed_at, phone, created_at, updated_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data) FROM stdin;
a9e96b5f-6e21-4018-ac6c-2249bc3be1d4	tchamer@aol.com	$2b$10$ZXvBrnkqrFZwCJqr0NQLxu6pgqTVzYHKL/ca.uDeiC4YvtnlOCAEC	2026-02-09 00:35:56.354+00	\N	2026-02-09 00:35:56.354+00	2026-04-09 21:55:59.631+00	2026-04-09 21:55:59.631+00	{}	{}
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

COPY "prj_q4H4APNVXzn0_storage".buckets (id, name, public, created_at, updated_at, file_size_limit, allowed_mime_types) FROM stdin;
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

COPY "prj_q4H4APNVXzn0_storage".objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, path_tokens, version) FROM stdin;
\.


--
-- Name: content_library content_library_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".content_library
    ADD CONSTRAINT content_library_pkey PRIMARY KEY (id);


--
-- Name: exam_bank exam_bank_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".exam_bank
    ADD CONSTRAINT exam_bank_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base knowledge_base_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".knowledge_base
    ADD CONSTRAINT knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: lesson_notes lesson_notes_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".lesson_notes
    ADD CONSTRAINT lesson_notes_pkey PRIMARY KEY (id);


--
-- Name: saved_content saved_content_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".saved_content
    ADD CONSTRAINT saved_content_pkey PRIMARY KEY (id);


--
-- Name: school_websites school_websites_domain_name_key; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".school_websites
    ADD CONSTRAINT school_websites_domain_name_key UNIQUE (domain_name);


--
-- Name: school_websites school_websites_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".school_websites
    ADD CONSTRAINT school_websites_pkey PRIMARY KEY (id);


--
-- Name: teachers teachers_auth_id_key; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".teachers
    ADD CONSTRAINT teachers_auth_id_key UNIQUE (auth_id);


--
-- Name: teachers teachers_email_key; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".teachers
    ADD CONSTRAINT teachers_email_key UNIQUE (email);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0_auth".identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0_auth".users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0_auth".users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_name_key; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0_storage".buckets
    ADD CONSTRAINT buckets_name_key UNIQUE (name);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0_storage".buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: objects objects_bucket_id_name_key; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0_storage".objects
    ADD CONSTRAINT objects_bucket_id_name_key UNIQUE (bucket_id, name);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0_storage".objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: idx_identities_user_id; Type: INDEX; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE INDEX idx_identities_user_id ON "prj_q4H4APNVXzn0_auth".identities USING btree (user_id);


--
-- Name: lesson_notes lesson_notes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".lesson_notes
    ADD CONSTRAINT lesson_notes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES "prj_q4H4APNVXzn0".teachers(id);


--
-- Name: saved_content saved_content_teacher_id_fkey; Type: FK CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".saved_content
    ADD CONSTRAINT saved_content_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES "prj_q4H4APNVXzn0".teachers(id) ON DELETE CASCADE;


--
-- Name: school_websites school_websites_teacher_id_fkey; Type: FK CONSTRAINT; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0".school_websites
    ADD CONSTRAINT school_websites_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES "prj_q4H4APNVXzn0".teachers(id);


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0_auth".identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES "prj_q4H4APNVXzn0_auth".users(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucket_id_fkey; Type: FK CONSTRAINT; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

ALTER TABLE ONLY "prj_q4H4APNVXzn0_storage".objects
    ADD CONSTRAINT objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES "prj_q4H4APNVXzn0_storage".buckets(id) ON DELETE CASCADE;


--
-- Name: lesson_notes Allow all lesson_notes; Type: POLICY; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE POLICY "Allow all lesson_notes" ON "prj_q4H4APNVXzn0".lesson_notes USING (true);


--
-- Name: saved_content Allow all saved_content; Type: POLICY; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE POLICY "Allow all saved_content" ON "prj_q4H4APNVXzn0".saved_content USING (true);


--
-- Name: school_websites Allow all school_websites; Type: POLICY; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE POLICY "Allow all school_websites" ON "prj_q4H4APNVXzn0".school_websites USING (true);


--
-- Name: teachers Allow all teachers; Type: POLICY; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE POLICY "Allow all teachers" ON "prj_q4H4APNVXzn0".teachers USING (true);


--
-- Name: content_library Public read content_library; Type: POLICY; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE POLICY "Public read content_library" ON "prj_q4H4APNVXzn0".content_library FOR SELECT USING (true);


--
-- Name: exam_bank Public read exam_bank; Type: POLICY; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE POLICY "Public read exam_bank" ON "prj_q4H4APNVXzn0".exam_bank FOR SELECT USING (true);


--
-- Name: knowledge_base Public read knowledge_base; Type: POLICY; Schema: prj_q4H4APNVXzn0; Owner: -
--

CREATE POLICY "Public read knowledge_base" ON "prj_q4H4APNVXzn0".knowledge_base FOR SELECT USING (true);


--
-- Name: content_library; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0".content_library ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_bank; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0".exam_bank ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0".knowledge_base ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_notes; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0".lesson_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_content; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0".saved_content ENABLE ROW LEVEL SECURITY;

--
-- Name: school_websites; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0".school_websites ENABLE ROW LEVEL SECURITY;

--
-- Name: teachers; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0".teachers ENABLE ROW LEVEL SECURITY;

--
-- Name: users Admin can insert users; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Admin can insert users" ON "prj_q4H4APNVXzn0_auth".users FOR INSERT TO "prj_q4H4APNVXzn0_role" WITH CHECK (true);


--
-- Name: users Admin can update all users; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Admin can update all users" ON "prj_q4H4APNVXzn0_auth".users FOR UPDATE TO "prj_q4H4APNVXzn0_role" USING (true);


--
-- Name: users Admin can view all users; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Admin can view all users" ON "prj_q4H4APNVXzn0_auth".users FOR SELECT TO "prj_q4H4APNVXzn0_role" USING (true);


--
-- Name: identities Users can delete own identities; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Users can delete own identities" ON "prj_q4H4APNVXzn0_auth".identities FOR DELETE USING ((user_id = "prj_q4H4APNVXzn0_auth".auth_uid()));


--
-- Name: users Users can delete own profile; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Users can delete own profile" ON "prj_q4H4APNVXzn0_auth".users FOR DELETE USING ((id = "prj_q4H4APNVXzn0_auth".auth_uid()));


--
-- Name: identities Users can insert own identities; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Users can insert own identities" ON "prj_q4H4APNVXzn0_auth".identities FOR INSERT WITH CHECK ((user_id = "prj_q4H4APNVXzn0_auth".auth_uid()));


--
-- Name: users Users can insert own profile; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Users can insert own profile" ON "prj_q4H4APNVXzn0_auth".users FOR INSERT WITH CHECK ((id = "prj_q4H4APNVXzn0_auth".auth_uid()));


--
-- Name: identities Users can update own identities; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Users can update own identities" ON "prj_q4H4APNVXzn0_auth".identities FOR UPDATE USING ((user_id = "prj_q4H4APNVXzn0_auth".auth_uid()));


--
-- Name: users Users can update own profile; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Users can update own profile" ON "prj_q4H4APNVXzn0_auth".users FOR UPDATE USING ((id = "prj_q4H4APNVXzn0_auth".auth_uid()));


--
-- Name: identities Users can view own identities; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Users can view own identities" ON "prj_q4H4APNVXzn0_auth".identities FOR SELECT USING ((user_id = "prj_q4H4APNVXzn0_auth".auth_uid()));


--
-- Name: users Users can view own profile; Type: POLICY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

CREATE POLICY "Users can view own profile" ON "prj_q4H4APNVXzn0_auth".users FOR SELECT USING ((id = "prj_q4H4APNVXzn0_auth".auth_uid()));


--
-- Name: identities; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0_auth".identities ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0_auth; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0_auth".users ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets Service role can manage buckets; Type: POLICY; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

CREATE POLICY "Service role can manage buckets" ON "prj_q4H4APNVXzn0_storage".buckets USING (true);


--
-- Name: objects Service role can manage objects; Type: POLICY; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

CREATE POLICY "Service role can manage objects" ON "prj_q4H4APNVXzn0_storage".objects USING (true);


--
-- Name: buckets; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0_storage".buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: prj_q4H4APNVXzn0_storage; Owner: -
--

ALTER TABLE "prj_q4H4APNVXzn0_storage".objects ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


