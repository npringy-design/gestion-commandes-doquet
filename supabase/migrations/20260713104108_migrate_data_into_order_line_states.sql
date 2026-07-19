-- Pont d'historique Supabase production, volontairement sans DDL.
--
-- La reprise historique des blobs app_state ne doit jamais être rejouée :
-- elle pourrait écraser des lignes plus récentes. Le SQL original reste
-- archivé sous supabase/legacy/remote_history/ pour preuve uniquement.

select 1;
