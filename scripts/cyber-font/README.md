# Police du skin Cyber

`Cyber Sans` est dérivée de **Rajdhani** (© 2014 Indian Type Foundry, SIL OFL 1.1), la police de
l'interface de Cyberpunk 2077. Une seule modification : ses dix chiffres prennent la même chasse,
centrés dans leur case. Rajdhani n'a pas de fonction `tnum` ; sans elle, le temps de repos et le
chrono de séance changent de largeur à chaque seconde et la ligne tremble. La famille est renommée,
comme TTY1 l'est de Terminus.

Pour la refaire, depuis les fichiers `woff2` latins de `@fontsource/rajdhani` :

```bash
pip install fonttools brotli
for w in 400 500 600 700; do
  python tabular_digits.py rajdhani-latin-$w-normal.woff2 cyber-$w.woff2 "Cyber Sans"
done
```

Pour l'instant, ces fichiers ne servent qu'à la maquette (`docs/design/mockups/2026-11-01-skin-cyber.html`),
qui les embarque en base64.
