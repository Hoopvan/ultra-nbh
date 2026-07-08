-- Corrige l'encodage corrompu des emojis/accents dans unlockables.
-- Cause probable : les octets UTF-8 des emojis ont été ré-interprétés en
-- Latin-1/CP1252 quelque part entre la copie du fichier 22_*.sql et son
-- exécution dans le SQL Editor Supabase (mojibake classique : 🎨 devient
-- "ðŸŽ¨"). Pour éviter que ça se reproduise, cette migration reconstruit
-- les valeurs à partir de leurs octets UTF-8 exacts (hex), donc immune à
-- toute réinterprétation d'encodage lors du copier-coller.
-- À exécuter dans Supabase Dashboard > SQL Editor

UPDATE public.unlockables SET icon = convert_from(decode('f09f8ea8', 'hex'), 'UTF8')       WHERE id = 'couleurs';
UPDATE public.unlockables SET icon = convert_from(decode('f09fa7a3', 'hex'), 'UTF8')       WHERE id = 'echarpe';
UPDATE public.unlockables SET icon = convert_from(decode('f09fa7a2', 'hex'), 'UTF8')       WHERE id = 'casquette';
UPDATE public.unlockables SET icon = convert_from(decode('f09f95b6efb88f', 'hex'), 'UTF8') WHERE id = 'lunettes';
UPDATE public.unlockables SET icon = convert_from(decode('f09f9195', 'hex'), 'UTF8')       WHERE id = 'maillot';
UPDATE public.unlockables SET icon = convert_from(decode('f09f8ebd', 'hex'), 'UTF8')       WHERE id = 'bandeau';

UPDATE public.unlockables
   SET name = convert_from(decode('c389636861727065', 'hex'), 'UTF8')
 WHERE id = 'echarpe';

UPDATE public.unlockables
   SET description = convert_from(decode('4c27c3a9636861727065206f6666696369656c6c65206465206c274865726d696e65', 'hex'), 'UTF8')
 WHERE id = 'echarpe' AND org_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.unlockables
   SET description = convert_from(decode('4c27c3a9636861727065206f6666696369656c6c6520647520636c7562', 'hex'), 'UTF8')
 WHERE id = 'echarpe' AND org_id = '00000000-0000-0000-0000-000000000002';

UPDATE public.unlockables
   SET description = convert_from(decode('5374796c65206173737572c3a920656e2074726962756e65', 'hex'), 'UTF8')
 WHERE id = 'lunettes';

-- Vérification rapide après exécution :
-- SELECT id, org_id, icon, name, description FROM public.unlockables ORDER BY org_id, sort_order;
