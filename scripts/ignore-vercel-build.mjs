const TEST_BRANCH = 'codex-setup-staging-workflow';
const PROD_BRANCH = 'main';

const branch = process.env.VERCEL_GIT_COMMIT_REF ?? '';
const appEnv = String(process.env.VITE_APP_ENV ?? process.env.APP_ENV ?? '').toLowerCase();
const branchUrl = String(process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL ?? '').toLowerCase();
const projectProductionUrl = String(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '').toLowerCase();

const looksLikeTestProject =
  appEnv === 'staging' ||
  appEnv === 'test' ||
  branchUrl.includes('gestion-commande-test') ||
  projectProductionUrl.includes('gestion-commande-test');

const looksLikeProdProject =
  !looksLikeTestProject &&
  (
    appEnv === 'production' ||
    appEnv === '' ||
    branchUrl.includes('gestion-commandes-doquet') ||
    projectProductionUrl.includes('gestion-commandes-doquet')
  );

let shouldBuild = false;
let reason = '';

if (looksLikeTestProject) {
  shouldBuild = branch === TEST_BRANCH;
  reason = shouldBuild
    ? `build autorisé : projet test sur ${TEST_BRANCH}`
    : `build ignoré : projet test déclenché par ${branch || 'branche inconnue'}`;
} else if (looksLikeProdProject) {
  shouldBuild = branch === PROD_BRANCH;
  reason = shouldBuild
    ? `build autorisé : projet production sur ${PROD_BRANCH}`
    : `build ignoré : projet production déclenché par ${branch || 'branche inconnue'}`;
} else {
  shouldBuild = true;
  reason = 'build autorisé par sécurité : projet Vercel non identifié';
}

console.log(`[ignore-vercel-build] ${reason}`);
console.log(`[ignore-vercel-build] branch=${branch || '-'} appEnv=${appEnv || '-'} branchUrl=${branchUrl || '-'} projectProductionUrl=${projectProductionUrl || '-'}`);

// Vercel ignoreCommand : exit 0 = ignorer le build, exit 1 = continuer le build.
process.exit(shouldBuild ? 1 : 0);
