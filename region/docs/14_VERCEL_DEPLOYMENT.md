# Vercel – Stavanger Z2

Publisering godkjent av eieren og gjennomført 02.11.2026.

- **URL:** https://stavangerz2.vercel.app/
- **Team:** Lorentzen Smart Labs (`team_vBbsxP14tEeOg0OdY8opN2Au`).
- **Prosjekt:** `stavangerz2` / `prj_mRi7N9aInDYLf91ru6fh5kkpoMed`.
- **Miljø/status:** Production / READY.
- **Deployment:** `dpl_6D2tpL5jtwJi69sR2HVPRtaKqH9N`.
- **Bygg:** Statisk HTML, lokalt ferdigbygd M3; ingen Git-revisjon eller automatisk Git-publisering. Vercel rapporterte bygget ferdig på 33 ms.
- **Spillfil:** 2 151 851 byte; SHA-256 `35bed8c9817b5b1e6dc999af335d017fce281e57c9f475456ccd41cc364f7981`.
- **Kontroll:** Offentlig HTTP 200 uten innlogging; innholdets SHA-256 matcher nøyaktig den gjennomgåtte lokale filen. Nettleseren starter spillet på dag 0 med portretter, kart og feltmappe. Etter ny innlasting viste «Fortsett dag 0» riktig lagring; personvalg ga gyldig speideroppdrag. Ingen dag ble løst under denne kontrollen. Skjermbilde: `evidence/m3-vercel-live.png`. Byggloggene viste vellykket utrulling. Ingen serverfunksjoner eller database er del av denne leveransen; ingen egen runtime-loggstrøm er konfigurert.
- **Lagring:** Lokal per nettleser og nettadresse. Tidligere localhost-/filbaserte lagringer flyttes med eksport/import; ingen eksisterende lokal gjennomspilling ble overskrevet ved publisering.

## Ny publisering

`dist/vercel/` inneholder den frosne M3-utgaven som ble publisert. `pnpm build:vercel` lager nå en separat fase 1-kandidat i `dist/vercel-phase1/` uten å publisere. Forhåndsvisningen bruker et eget lagringsnavnerom. Eksisterende prosjekt `stavangerz` ble ikke endret.
