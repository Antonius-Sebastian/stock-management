-- Drop the batch_finished_goods table
-- This removes the ability to track which finished goods were produced from each batch
-- Finished goods stock is now managed independently through stock movements

DROP TABLE IF EXISTS "batch_finished_goods" CASCADE;
