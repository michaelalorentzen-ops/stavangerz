# v0.4 lokale verdensobjekter

Ni originale, gjenbrukbare low-poly GLB-modeller for det lokale MapLibre-kartet. Ingen eksterne modeller, teksturer, nettjenester eller kjøpte assets. Kilden er `tools/blender/build_world_assets.py`; `.blend` er ikke nødvendig. Oppdraget endrer ingen spillregler eller lagringer. D04–07 gjelder fortsatt: renderer velger bare faktisk synlige objekter ved relevant zoom og må ikke tillegge områdebasert vakt en oppdiktet posisjon.

## Leveranse og kontrakt

`apps/game-client/public/models/stavangerz/manifest.json` har `assets` som dictionary med stabile ID-er, `url`, `scale: 1`, `meters: {width, depth, height}`, faktiske `animations`, `triangles`, `meshes`, `materials`, `bytes` og proveniens. URL-er begynner `/models/stavangerz/`. Alle ressurser er innbakt i hver GLB; ingen teksturforespørsler.

- `crew-ingrid`: olivengrønn skalljakke, mørk hals, brunt hår med hestehale.
- `crew-marius`: jordbrun jakke, rustfarget hals, blondt hår/skjegg.
- `crew-leila`: petroljakke, lys saueullkrage, mørke krøller og varmere hudtone.
- `crew-tor`: marineblå arbeidsjakke, rustfarget hals, grått hår og bart.
- `zombie`: grå arbeidsklær, grønnlig hud, falmet vest og fremstrakte armer.
- `hq`: rødmalt maritimt trehus, falset tak, vinduer, inngang, radioantenne, signalflagg, pipe, regntønner og vedlager.
- `barricade`: gjenbrukstømmer på bukker, varselsmarkeringer, sandsekk og vaktlys.
- `boat`: åpen fiskebåt med spiss baug, benker, årer, påhengsmotor og drivstoffkanne.
- `supply-crates`: stabel med merkede forsyningskasser, lokk, beslag og håndtak.

Crew-identiteter følger de eksisterende portrettene i `public/art/crew/`, vurdert visuelt før modellering. Dette er stiliserte kartfigurer med ansikt, nese, øyne, hår, jakke, lommer, stropper, ryggsekk og støvler; ingen fotorealistisk likhetsgaranti. Miljøpaletten bruker jordfarger, maritim petrol/marineblå, værbitt tre, krem og rust.

Blender bruker meter og Z opp; eksport følger vanlig glTF med Y opp og front mot +Z. En grunnnode ved (0,0,0) legger modellens laveste punkt i bakken uten å endre animasjonskanalene. Figurer er ca. 1,7–1,85 m; huset ca. 7,4 × 5,6 m inkludert utstyr. Kartets presentasjon kan bruke egen lesbar skala; manifestet oppgir fysisk originalstørrelse.

## Bevegelse og budsjett

Alle fire crew og zombien har tre ekte eksporterte NLA-klipp: `Idle` (2 s), `Walk` (1 s), `Guard` (2 s), 24 fps. Gang beveger hofter/bein og skuldre/armer i motfase; idle puster; guard løfter armene med liten vaktbevegelse. Klippene starter på 0 og slutter med samme transform som de begynner. Bevegelsen er på stedet: spillmotorens posisjon/rute er autoritativ. Ingen root motion, lyd eller spilllogikk. Delte mesh-/materialressurser kan gjenbrukes, men hver figur trenger egen animasjonstilstand.

Figurer har 2196–2768 trekanter, zombien 2536; huset 1708, barrikaden 476, båten 638 og kassene 312. Deler er slått sammen per materiale og animasjonspivot for å redusere drawcalls. Den samlede GLB-pakken er ca. 1,3 MB. PNG-forhåndsvisningene brukes til review og skal ikke lastes av kartlaget.

## Reproduksjon og kontroll

Fra repo-roten, med Blender 4.3.2:

```sh
blender -b -t 2 --python region/tools/blender/build_world_assets.py
python region/tools/blender/verify_world_assets.py
```

For bare GLB/manifest, legg `-- --skip-render` til Blender-kommandoen. Headless CPU-rendering bruker Cycles uten denoiser (den lokale Blender-bygningen har ikke OpenImageDenoise). Ingen Python-bildebehandling brukes.

Verifikatoren leser GLB-binærdata og kontrollerer innebygde ressurser, eksakte klippnavn, starttid/varighet, endelige samples, faktiske bevegelser og lukkede loopendepunkter. Alle ni GLB-er er generert lokalt. `contact-sheet.png` og `crew-preview.png` er rendret av Blender og inspisert visuelt; kasser/captions er flyttet til synlige plasser og portrettfarger/silhuetter kontrollert. Kamera/lys/bakgrunn tilhører bare review-renderingen og eksporteres ikke til spillmodellene.

Dette verifiserer assetpakken. Visuell tilpasning, viewportgrenser, instansbudsjett og nettleseravspilling verifiseres av kartintegrasjonen.
