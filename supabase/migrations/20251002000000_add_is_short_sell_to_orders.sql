-- Add is_short_sell field to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_short_sell BOOLEAN DEFAULT false;

-- Add error_message field to orders table for better error tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Update the order_status enum to include 'processing' and 'failed' statuses
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'failed';

