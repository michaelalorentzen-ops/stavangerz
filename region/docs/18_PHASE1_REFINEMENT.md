# Fase 1 etter spilltesten til dag 15

Spilltesten og [designrevisjonen](17_PHASE1_DESIGN_REVISION.md) styrer denne leveransen.

| Tilstand | Vurdering |
| --- | --- |
| Fungerer | Ett døgn per tur, endelig loot, søk med lagret fremdrift, rekruttering per person og forsvar av passasjer. Behold konkurransen om arbeidskraft mellom vakt, omsorg og bygging. |
| Tekniske feil | Forhåndsvisningen blander fare for laget med muligheten for at arbeidet stanser. Dagsrapporten gjør det vanskelig å se hvilken sone som er tapt og hvorfor helse gikk ned. |
| Spilldesign | HQ er for raskt å etablere. Grundig søk trenger en verdi utover forsyninger. Åpningen må vise hvem de fire er og hva som skjer rundt dem. |
| Mangler | Et kartutkast for den større regionen. Gjeldende spillkart har allerede en nestet områdemodell, eksplisitte forbindelser og lagringer med kartkopi. |
| Utsettes | Omlegging av verdensdata, fase 2, større utstyrskatalog, overnatting ute og nye produksjonskjeder. |

Gjennomfør først de fem spillforbedringene i eksisterende sløyfe. Vis deretter den nye geografien som et utkast med foreløpige ID-er og forbindelser. Spill til et fungerende HQ med den reviderte sløyfen og vurder hva arbeidet fortrenger underveis. Test spesielt at eldre lagringer kan åpnes, og at et forsvar som avbrytes lar materialene ligge igjen i leiren.

[Det reviderte kartutkastet](evidence/phase1-road-map.png) bruker OpenStreetMap-geometri for kystlinjer, gater og broer. Gult viser sju valgte ruter. Stiplede strekk viser foreslåtte grenseforlengelser. De operative grensene og ID-ene på Hundvåg er utkast til neste verdensversjon. Den tidligere [skissen](evidence/phase1-map-proposal.svg) viser den opprinnelige konseptinndelingen.

Kartet kan gjenskapes med `python scripts/render-phase1-road-map.py` fra prosjektmappen med Shapely, Matplotlib og fem OSM API 0.6-uttrekk i `.tools/imports/phase1-revision/`. Lagre dem som `revision-0.xml` til `revision-4.xml` i denne rekkefølgen. Boksene er `5.707,58.980,5.731,58.998`, `5.731,58.980,5.756,58.998`, `5.707,58.998,5.731,59.018`, `5.731,58.998,5.756,59.018` og `5.7555,58.981,5.781,59.015`. © [OpenStreetMap-bidragsytere](https://www.openstreetmap.org/copyright), ODbL.
