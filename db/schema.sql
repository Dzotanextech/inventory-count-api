--
-- PostgreSQL database dump
--


-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

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
-- Name: ApprovalAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ApprovalAction" AS ENUM (
    'SUBMIT',
    'APPROVE',
    'REJECT',
    'RECOUNT'
);


--
-- Name: InventoryCountStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InventoryCountStatus" AS ENUM (
    'DRAFT',
    'IN_PROGRESS',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'RECOUNT'
);


--
-- Name: InventoryCountType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InventoryCountType" AS ENUM (
    'FULL',
    'CATEGORY',
    'PRODUCT',
    'RACK',
    'CYCLE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id text NOT NULL,
    "inventoryCountId" text NOT NULL,
    action public."ApprovalAction" NOT NULL,
    remarks text,
    "performedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    action text NOT NULL,
    "oldValue" jsonb,
    "newValue" jsonb,
    "performedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batches (
    id text NOT NULL,
    "productId" text NOT NULL,
    "batchNumber" text NOT NULL,
    "manufacturingDate" timestamp(3) without time zone,
    "expiryDate" timestamp(3) without time zone
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL
);


--
-- Name: inventory_count_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_count_items (
    id text NOT NULL,
    "inventoryCountId" text NOT NULL,
    "productId" text NOT NULL,
    "batchId" text,
    "rackId" text,
    "systemQty" numeric(12,4) DEFAULT 0 NOT NULL,
    "physicalQty" numeric(12,4),
    "varianceQty" numeric(12,4),
    "varianceValue" numeric(14,2),
    reason text,
    remarks text,
    "countedById" text,
    "countedAt" timestamp(3) without time zone
);


--
-- Name: inventory_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_counts (
    id text NOT NULL,
    "countNumber" text NOT NULL,
    "warehouseId" text NOT NULL,
    "countType" public."InventoryCountType" NOT NULL,
    status public."InventoryCountStatus" DEFAULT 'DRAFT'::public."InventoryCountStatus" NOT NULL,
    "countDate" timestamp(3) without time zone NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "createdById" text NOT NULL,
    "submittedById" text,
    "approvedById" text,
    "startedAt" timestamp(3) without time zone,
    "submittedAt" timestamp(3) without time zone,
    "approvedAt" timestamp(3) without time zone,
    "totalVarianceValue" numeric(14,2) DEFAULT 0 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: inventory_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_locations (
    id text NOT NULL,
    "warehouseId" text NOT NULL,
    "rackId" text,
    "productId" text NOT NULL,
    "batchId" text,
    quantity numeric(12,4) DEFAULT 0 NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text NOT NULL,
    "categoryId" text NOT NULL,
    sku text NOT NULL,
    barcode text NOT NULL,
    name text NOT NULL,
    description text,
    uom text NOT NULL,
    "costPrice" numeric(12,4) NOT NULL,
    "sellingPrice" numeric(12,4) NOT NULL,
    "isBatchTracked" boolean DEFAULT false NOT NULL
);


--
-- Name: racks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.racks (
    id text NOT NULL,
    "zoneId" text NOT NULL,
    "rackCode" text NOT NULL,
    barcode text NOT NULL,
    "binCount" integer DEFAULT 1 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    "userId" text NOT NULL,
    token_hash text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    "roleId" text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id text NOT NULL,
    "warehouseId" text NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: batches batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_count_items inventory_count_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT inventory_count_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_counts inventory_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_pkey PRIMARY KEY (id);


--
-- Name: inventory_locations inventory_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: racks racks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racks
    ADD CONSTRAINT racks_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: approvals_inventoryCountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "approvals_inventoryCountId_idx" ON public.approvals USING btree ("inventoryCountId");


--
-- Name: audit_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_createdAt_idx" ON public.audit_logs USING btree ("createdAt");


--
-- Name: audit_logs_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_entityType_entityId_idx" ON public.audit_logs USING btree ("entityType", "entityId");


--
-- Name: audit_logs_performedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_performedById_idx" ON public.audit_logs USING btree ("performedById");


--
-- Name: batches_productId_batchNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "batches_productId_batchNumber_key" ON public.batches USING btree ("productId", "batchNumber");


--
-- Name: batches_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "batches_productId_idx" ON public.batches USING btree ("productId");


--
-- Name: categories_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);


--
-- Name: inventory_count_items_inventoryCountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_count_items_inventoryCountId_idx" ON public.inventory_count_items USING btree ("inventoryCountId");


--
-- Name: inventory_count_items_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_count_items_productId_idx" ON public.inventory_count_items USING btree ("productId");


--
-- Name: inventory_counts_countNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "inventory_counts_countNumber_key" ON public.inventory_counts USING btree ("countNumber");


--
-- Name: inventory_counts_countType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_counts_countType_idx" ON public.inventory_counts USING btree ("countType");


--
-- Name: inventory_counts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_counts_status_idx ON public.inventory_counts USING btree (status);


--
-- Name: inventory_counts_warehouseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_counts_warehouseId_idx" ON public.inventory_counts USING btree ("warehouseId");


--
-- Name: inventory_locations_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_locations_productId_idx" ON public.inventory_locations USING btree ("productId");


--
-- Name: inventory_locations_rackId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_locations_rackId_idx" ON public.inventory_locations USING btree ("rackId");


--
-- Name: inventory_locations_warehouseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_locations_warehouseId_idx" ON public.inventory_locations USING btree ("warehouseId");


--
-- Name: products_barcode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_barcode_idx ON public.products USING btree (barcode);


--
-- Name: products_barcode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_barcode_key ON public.products USING btree (barcode);


--
-- Name: products_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "products_categoryId_idx" ON public.products USING btree ("categoryId");


--
-- Name: products_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_sku_idx ON public.products USING btree (sku);


--
-- Name: products_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku);


--
-- Name: racks_barcode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX racks_barcode_key ON public.racks USING btree (barcode);


--
-- Name: racks_zoneId_rackCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "racks_zoneId_rackCode_key" ON public.racks USING btree ("zoneId", "rackCode");


--
-- Name: refresh_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens USING btree (token_hash);


--
-- Name: refresh_tokens_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "refresh_tokens_userId_idx" ON public.refresh_tokens USING btree ("userId");


--
-- Name: roles_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: warehouses_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX warehouses_code_key ON public.warehouses USING btree (code);


--
-- Name: zones_warehouseId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "zones_warehouseId_code_key" ON public.zones USING btree ("warehouseId", code);


--
-- Name: approvals approvals_inventoryCountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT "approvals_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES public.inventory_counts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: approvals approvals_performedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT "approvals_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_performedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: batches batches_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT "batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_count_items inventory_count_items_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT "inventory_count_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.batches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_count_items inventory_count_items_countedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT "inventory_count_items_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_count_items inventory_count_items_inventoryCountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT "inventory_count_items_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES public.inventory_counts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_count_items inventory_count_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT "inventory_count_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_count_items inventory_count_items_rackId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT "inventory_count_items_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES public.racks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_counts inventory_counts_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT "inventory_counts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_counts inventory_counts_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT "inventory_counts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_counts inventory_counts_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT "inventory_counts_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_counts inventory_counts_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT "inventory_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_locations inventory_locations_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT "inventory_locations_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.batches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_locations inventory_locations_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT "inventory_locations_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_locations inventory_locations_rackId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT "inventory_locations_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES public.racks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_locations inventory_locations_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT "inventory_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: products products_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: racks racks_zoneId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racks
    ADD CONSTRAINT "racks_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES public.zones(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: zones zones_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT "zones_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


