#!/usr/bin/env bash
# Construye el sitio de GitHub Pages en dist/ para recorrer la evolución del diseño:
#   dist/                      versión vigente (el checkout actual, normalmente main)
#   dist/<tag>/                cada versión etiquetada (v1, v2…), construida desde su propio commit
#   dist/prototipos/<nombre>/  cada rama *prototipo-<nombre> (material para las revisiones)
#   dist/versiones/            índice con enlace, fecha y commit de cada una
# En CI requiere un checkout con fetch-depth: 0 (trae tags y ramas).
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build

work="$(mktemp -d)"
trap 'rm -rf "$work"; git worktree prune' EXIT

# Construye una referencia en dist/<destino>. Una versión antigua que falle no bloquea la publicación.
build_ref() {
  local ref=$1 dest=$2 dir="$work/${2//\//_}" ok
  git worktree add --detach --quiet "$dir" "$ref" &&
    (cd "$dir" && npm ci --no-audit --no-fund --loglevel=error && npm run build) &&
    mkdir -p "dist/$dest" && cp -R "$dir/dist/." "dist/$dest/"
  ok=$?
  git worktree remove --force "$dir" 2>/dev/null || true
  return $ok
}

escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
# Fila del índice: enlace, nombre, fecha y commit de la referencia, descripción y estado.
row() {
  local href=$1 label=$2 ref=$3 note=$4 status=$5 date sha
  date=$(git log -1 --format=%cs "$ref")
  sha=$(git rev-parse --short "$ref^{commit}")
  if [ "$status" = ok ]; then
    printf '<li><a href="%s">%s</a><span>%s · <code>%s</code></span><small>%s</small></li>\n' "$href" "$label" "$date" "$sha" "$(printf '%s' "$note" | escape)"
  else
    printf '<li><strong>%s</strong><span>%s · <code>%s</code></span><small>No se pudo construir; revisar el registro del workflow.</small></li>\n' "$label" "$date" "$sha"
  fi
}

current=$(git rev-parse --abbrev-ref HEAD)
rows=$(row "../" "Versión vigente" HEAD "Rama $current: la versión publicada en la raíz del sitio." ok)

for tag in $(git tag --list 'v*' --sort=version:refname); do
  if build_ref "$tag" "$tag"; then status=ok; else status=error; echo "::warning::No se pudo construir $tag"; fi
  rows+=$'\n'$(row "../$tag/" "$(echo "$tag" | tr '[:lower:]' '[:upper:]')" "$tag" "$(git for-each-ref "refs/tags/$tag" --format='%(contents:subject)')" "$status")
done

# Prototipos: ramas locales y remotas cuyo nombre contiene «prototipo-» (sin repetir nombres).
declare -A seen=()
for ref in $(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes/origin | grep -E 'prototipo-' || true); do
  name=${ref##*prototipo-}
  [ -n "${seen[$name]:-}" ] && continue
  seen[$name]=1
  if build_ref "$ref" "prototipos/$name"; then status=ok; else status=error; echo "::warning::No se pudo construir $ref"; fi
  rows+=$'\n'$(row "../prototipos/$name/" "Prototipo $name" "$ref" "$(git log -1 --format=%s "$ref")" "$status")
done

mkdir -p dist/versiones
cat > dist/versiones/index.html <<HTML
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Versiones · El pulso de Nueva York</title>
<style>
body{margin:0;background:#f7f9f9;color:#233d49;font:15px/1.5 Arial,sans-serif}
main{max-width:760px;margin:auto;padding:40px 20px}
h1{color:#173c50;margin:0 0 6px}p{color:#526a77;margin:0 0 24px}
ul{list-style:none;padding:0;margin:0;border-top:1px solid #dbe3e6}
li{display:grid;grid-template-columns:1fr auto;gap:2px 16px;padding:14px 0;border-bottom:1px solid #dbe3e6}
li small{grid-column:1/-1;color:#607580}a{color:#24668c;font-weight:600}span{color:#607580;font-size:13px}
</style>
</head>
<body><main>
<h1>Versiones del proyecto</h1>
<p>Grupo 16 · Cada versión se construye desde su propio commit etiquetado en GitHub.</p>
<ul>
$rows
</ul>
</main></body>
</html>
HTML
echo "Sitio listo en dist/ (versiones: dist/versiones/index.html)"
