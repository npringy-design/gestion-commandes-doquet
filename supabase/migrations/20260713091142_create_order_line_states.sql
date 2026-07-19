-- Pont d'historique Supabase TEST, volontairement sans DDL.
--
-- TEST a déjà enregistré cette version avec la création historique de
-- order_line_states. Sur une base neuve, la baseline canonique
-- 20260719101200 crée la table. Sur TEST, ce marqueur est ignoré car la
-- version est déjà présente. Il permet à la CLI de comparer les historiques
-- uniquement par timestamp, comme prévu par Supabase.

select 1;
