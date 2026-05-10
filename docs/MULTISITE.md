# Multisite

## Principe

L'application est multisite et isole les donnees avec `site_id`.

Chaque restaurant doit avoir un `site_id` stable.

Exemples :

- `hippo_thillois`
- `hippo_st_thibault`

## app_state

`app_state` est isole par le couple :

```text
site_id + key
```

Une meme `key` peut exister pour plusieurs sites, mais chaque valeur doit rester rattachee au bon `site_id`.

## Regle de securite

Une donnee d'un site ne doit jamais etre sauvegardee sur un autre site.

Avant de tester un changement, verifier que `VITE_SITE_ID` correspond bien au restaurant cible.
