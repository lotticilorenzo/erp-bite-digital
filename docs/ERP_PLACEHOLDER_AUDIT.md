# ERP Placeholder and Broken Flow Audit

Data audit: 2026-05-03
Workspace: `c:\Users\lotti\Desktop\erp-bite-digital`

## Metodo

- Controlli piccoli e focalizzati per sezione.
- Verifica mista: lettura codice + check UI locale quando possibile.
- Nel file vengono segnati sia placeholder espliciti sia funzioni/bottoni con comportamento incompleto o errato.

## Legenda

- `VERIFICATO`: comportamento confermato da codice o da test locale.
- `DA APPROFONDIRE`: indizio forte, da confermare meglio in UI o con dati reali.

## Findings

### Auth e pagine pubbliche

1. `VERIFICATO` - Il recupero password si rompe se la pagina viene aperta o ricaricata direttamente.
Motivo: l'interceptor globale su `401` rimanda a `/login` ogni route diversa da `/login`, quindi anche `/forgot-password` e `/reset-password`.
Evidenza:
- `frontend/src/lib/api.ts:19`
- `frontend/src/lib/api.ts:25`
- Check UI locale: ricarica di `/forgot-password` porta a `/login`
- Check UI locale: apertura diretta di `/reset-password?token=testtoken` porta a `/login`

2. `VERIFICATO` - La pagina reset password usa un endpoint frontend errato.
Motivo: il client Axios ha gia `baseURL=/api/v1`, ma il submit chiama `"/api/v1/auth/reset-password"`, producendo un path doppio.
Evidenza:
- `frontend/src/lib/api.ts:5`
- `frontend/src/pages/ResetPassword.tsx:63`
- Endpoint backend corretto presente in `backend/app/api/v1/auth.py:229`

### Finance / Fatture

3. `VERIFICATO` - Bottone `Scarica PDF` nel dettaglio fattura senza azione collegata.
Evidenza:
- `frontend/src/components/finance/FatturaDetailDialog.tsx:130`

4. `VERIFICATO` - Bottone `Vai su FIC` nel dettaglio fattura senza azione collegata.
Evidenza:
- `frontend/src/components/finance/FatturaDetailDialog.tsx:134`

5. `VERIFICATO` - Bottone `Invia Sollecito` nel dettaglio fattura solo simulato.
Motivo: mostra solo toast informativo, nessuna integrazione reale.
Evidenza:
- `frontend/src/components/finance/FatturaDetailDialog.tsx:332`

6. `VERIFICATO` - Dettaglio righe fattura puo mostrare stato incompleto anche su documenti reali.
Motivo: se `fic_raw_data.items` o `fic_raw_data.details` non esistono, compare messaggio di fallback.
Evidenza:
- `frontend/src/components/finance/FatturaDetailDialog.tsx:58`
- `frontend/src/components/finance/FatturaDetailDialog.tsx:289`

7. `VERIFICATO` - Bottone `Esporta` nella pagina fatture senza azione collegata.
Evidenza:
- `frontend/src/pages/Fatture.tsx:105`

8. `VERIFICATO` - Bottone `Filtra per Mese` nella pagina fatture senza azione collegata.
Evidenza:
- `frontend/src/pages/Fatture.tsx:191`

9. `VERIFICATO` - Le fatture attive possono mostrare `Cliente Sconosciuto` anche quando il cliente esiste.
Motivo: la tabella prova a leggere `item.cliente.ragione_sociale`, ma il response model API delle fatture attive non espone il nested `cliente`; espone solo `cliente_id`.
Evidenza:
- `frontend/src/components/finance/FattureTable.tsx:108`
- `backend/app/api/v1/fic.py:51`
- `backend/app/schemas/schemas.py:860`
- `backend/app/services/services.py:1835`
- Check API locale: `GET /api/v1/fatture-attive` restituisce `cliente_id` ma non `cliente`
- Check UI locale: piu righe in `/fatture` mostrate come `Cliente Sconosciuto`

### CRM

10. `VERIFICATO` - Invio email da scheda lead non invia una mail reale.
Motivo: il frontend simula delay e poi salva solo un'attivita CRM di tipo `EMAIL`.
Evidenza:
- `frontend/src/pages/LeadDetail.tsx:84`
- `frontend/src/pages/LeadDetail.tsx:92`
- `frontend/src/pages/LeadDetail.tsx:95`

11. `VERIFICATO` - Anche lato backend esiste solo una funzione mock per l'invio email CRM.
Evidenza:
- `backend/app/services/crm_service.py:83`

12. `VERIFICATO` - Bottone icona allegato nel tab email lead non ha handler.
Evidenza:
- `frontend/src/pages/LeadDetail.tsx:412`

13. `VERIFICATO` - Lead score puo usare fallback fisso `78`, quindi il valore mostrato non sempre e reale.
Evidenza:
- `frontend/src/pages/LeadDetail.tsx:52`

14. `DA APPROFONDIRE` - La card `Prossima Mossa Suggerita` comunica AI/lead intelligence, ma deriva da logica statica su `leadScore`.
Evidenza:
- `frontend/src/pages/LeadDetail.tsx:321`

### Privacy / Settings

15. `VERIFICATO` - La UI sessioni mostra solo una sessione "corrente" per limiti architetturali.
Motivo: backend dichiara esplicitamente inventario sessioni non supportato.
Evidenza:
- `backend/app/api/v1/auth.py:87`
- `frontend/src/pages/settings/PrivacySettings.tsx:156`

16. `VERIFICATO` - `Elimina Account` e solo placeholder disabilitato.
Evidenza:
- `frontend/src/pages/settings/PrivacySettings.tsx:252`
- `frontend/src/pages/settings/PrivacySettings.tsx:257`

### Topbar / navigazione

17. `VERIFICATO` - La ricerca globale in topbar appare placeholder.
Motivo: input presente con hint `Ctrl K`, ma in questo componente non esiste logica di ricerca e non esiste shortcut `Ctrl+K`.
Evidenza:
- `frontend/src/components/layout/AppTopbar.tsx:143`
- `frontend/src/components/layout/AppTopbar.tsx:147`

18. `VERIFICATO` - L'unica scorciatoia implementata in topbar e `?` per il pannello assistenza.
Evidenza:
- `frontend/src/components/layout/AppTopbar.tsx:40`
- `frontend/src/components/layout/AppTopbar.tsx:47`

### Progetti

19. `VERIFICATO` - Bottone `Filtri` nella lista progetti senza azione collegata.
Motivo: il bottone e renderizzato senza `onClick`, dialog o dropdown associati.
Evidenza:
- `frontend/src/components/progetti/ProgettoTable.tsx:95`

### Commesse

20. `VERIFICATO` - Icona modifica nella tabella `Progetti Coinvolti` della scheda commessa senza handler.
Motivo: il pulsante con icona `Edit2` e presente ma non ha `onClick`.
Evidenza:
- `frontend/src/pages/CommessaDetail.tsx:679`

21. `VERIFICATO` - Bottone `Collega ora` nella sezione fatture della scheda commessa senza azione collegata.
Motivo: il pulsante e renderizzato nello stato vuoto ma non ha `onClick`.
Evidenza:
- `frontend/src/pages/CommessaDetail.tsx:815`

### Cassa

22. `VERIFICATO` - Bottone `Ultimi 30 Giorni` nella pagina cassa senza azione collegata.
Evidenza:
- `frontend/src/pages/Cassa.tsx:51`

23. `VERIFICATO` - Bottone `Importa Estratto` nella pagina cassa senza azione collegata.
Evidenza:
- `frontend/src/pages/Cassa.tsx:55`

24. `VERIFICATO` - Bottone `Vedi Tutti` nella sezione movimenti recenti della pagina cassa senza azione collegata.
Evidenza:
- `frontend/src/pages/Cassa.tsx:70`

25. `VERIFICATO` - Bottone `Riconcilia con fattura` nella tabella movimenti puo essere visibile ma non fare nulla.
Motivo: il componente tabella espone `onRiconcilia`, ma la pagina cassa passa solo `onImputa`.
Evidenza:
- `frontend/src/components/finance/MovimentiTable.tsx:95`
- `frontend/src/pages/Cassa.tsx:75`

### Preventivi

26. `VERIFICATO` - Bottone `Filtri Avanzati` nella pagina preventivi senza azione collegata.
Evidenza:
- `frontend/src/pages/PreventiviPage.tsx:141`

### Fornitori

27. `VERIFICATO` - Bottone filtro nella pagina fornitori senza azione collegata.
Evidenza:
- `frontend/src/pages/Fornitori.tsx:144`

28. `VERIFICATO` - Azione `Vedi Fatture` nella lista fornitori punta a una route errata.
Motivo: naviga verso `/finanza/fatture?fornitore=...`, ma il router espone `/fatture`.
Evidenza:
- `frontend/src/pages/Fornitori.tsx:246`
- `frontend/src/App.tsx:148`

29. `VERIFICATO` - Dal dettaglio fattura passiva il click sul fornitore porta a una scheda non esistente.
Motivo: la UI naviga verso `/fornitori/:id`, ma il router espone solo la lista `/fornitori`.
Evidenza:
- `frontend/src/components/finance/FatturaDetailDialog.tsx:159`
- `frontend/src/App.tsx:153`

### Analytics

30. `VERIFICATO` - Alcune card cliccabili di `Critical Insights` non hanno una destinazione reale.
Motivo: il click gestisce solo titoli con `Sforamento`, `Margine basso`, `Rischio Incasso`, `Benchmark Negativo` o `Scaduto`; alert come `Marginalità in calo` e `Crescita Fatturato!` vengono creati ma non matchano nessun ramo.
Evidenza:
- `frontend/src/pages/Analytics.tsx:652`
- `frontend/src/pages/Analytics.tsx:660`
- `frontend/src/pages/Analytics.tsx:1672`

31. `DA APPROFONDIRE` - La sezione `Forecast Business (30/60/90g)` combina due logiche diverse e rischia di sembrare piu intelligente di quanto sia.
Motivo: sopra usa `ForecastWidget` collegato a `useForecast("/analytics/forecast")`, sotto mostra card separate costruite localmente con euristiche su storico commesse, clienti ricorrenti e fattori di prudenza.
Evidenza:
- `frontend/src/components/analytics/ForecastWidget.tsx:53`
- `frontend/src/hooks/useForecast.ts:36`
- `frontend/src/pages/Analytics.tsx:684`
- `frontend/src/pages/Analytics.tsx:1712`
- `frontend/src/pages/Analytics.tsx:1715`

### CRM

32. `VERIFICATO` - Bottone `Esporta CSV` nella pagina CRM senza azione collegata.
Evidenza:
- `frontend/src/pages/CRM.tsx:139`

33. `VERIFICATO` - La sezione `Automazioni` del CRM e in larga parte placeholder/static.
Motivo: i toggle `Attiva/Disattiva` delle card non hanno handler, `Vedi Log Completi` non ha handler e la cronologia automazioni e costruita da un array inline hardcoded.
Evidenza:
- `frontend/src/pages/CRM.tsx:281`
- `frontend/src/pages/CRM.tsx:287`
- `frontend/src/pages/CRM.tsx:380`

34. `VERIFICATO` - La sezione `Setup` del CRM e dichiaratamente placeholder.
Motivo: mostra esplicitamente `Coming soon` per stadi funnel, campi custom e permessi.
Evidenza:
- `frontend/src/pages/CRM.tsx:315`

### Wiki

35. `VERIFICATO` - Bottone `Share` nella vista articolo wiki senza azione collegata.
Evidenza:
- `frontend/src/components/wiki/WikiArticleView.tsx:91`

36. `VERIFICATO` - I breadcrumb della wiki appaiono cliccabili ma non navigano.
Motivo: usano `cursor-pointer` e hover visuale, ma non hanno link o `onClick`.
Evidenza:
- `frontend/src/components/wiki/WikiArticleView.tsx:77`
- `frontend/src/components/wiki/WikiArticleView.tsx:79`

### Dashboard

37. `VERIFICATO` - Shortcut `Collaboratori Online` in dashboard non apre un collaboratore specifico.
Motivo: il dropdown naviga a `/collaboratori?id=...`, ma la pagina Collaboratori non legge query param e gestisce il collaboratore selezionato solo via stato locale.
Evidenza:
- `frontend/src/pages/Dashboard.tsx:325`
- `frontend/src/pages/Collaboratori.tsx:1`
- `frontend/src/pages/Collaboratori.tsx:78`
- `frontend/src/pages/Collaboratori.tsx:205`

### Collaboratori

38. `VERIFICATO` - Bottone `Vedi Analisi Costi` nella card collaboratore senza azione collegata.
Evidenza:
- `frontend/src/pages/Collaboratori.tsx:399`

### Studio OS

39. `VERIFICATO` - Il bottone pop-out nelle tab di Studio OS compare anche dove la finestra separata non e supportata.
Motivo: `WorkspaceTabs` mostra `openPopout` per qualunque tab con `linkedId`, ma `PopoutPage` gestisce solo `TASK`; per altri tipi mostra `Tipo non supportato`.
Evidenza:
- `frontend/src/components/studio/WorkspaceTabs.tsx:78`
- `frontend/src/components/studio/WorkspaceTabs.tsx:82`
- `frontend/src/pages/PopoutPage.tsx:22`
- `frontend/src/pages/PopoutPage.tsx:28`

40. `VERIFICATO` - La vista `Overview` di Studio usa endpoint frontend errato e per i progetti usa anche il nome route sbagliato.
Motivo: il client ha gia `baseURL=/api/v1`, ma la pagina chiama `"/api/v1/${targetType}/${targetId}/stats"`; inoltre per i progetti usa `projects` mentre il backend espone `progetti`.
Evidenza:
- `frontend/src/lib/api.ts:5`
- `frontend/src/pages/studio/StudioOverviewPage.tsx:64`
- `frontend/src/pages/studio/StudioOverviewPage.tsx:65`
- `frontend/src/pages/studio/StudioOverviewPage.tsx:73`
- `backend/app/api/v1/clienti.py:195`
- `backend/app/api/v1/progetti.py:179`

41. `VERIFICATO` - La `Overview` globale di Studio puo rimanere in skeleton infinito se aperta senza cliente o progetto selezionato.
Motivo: la topbar permette sempre `setView("overview")`; se non c'e `targetId`, l'effetto esce subito, `loading` resta `true` e il componente continua a renderizzare il placeholder.
Evidenza:
- `frontend/src/components/studio/StudioTopbar.tsx:138`
- `frontend/src/pages/Studio.tsx:27`
- `frontend/src/pages/studio/StudioOverviewPage.tsx:62`
- `frontend/src/pages/studio/StudioOverviewPage.tsx:68`
- `frontend/src/pages/studio/StudioOverviewPage.tsx:98`

42. `VERIFICATO` - La vista `Lista` di Studio a livello cartella/cliente filtra le task con un ID sbagliato.
Motivo: le folder di Studio mappano `Cliente[]`, ma quando e selezionata solo la cartella il filtro usa `task.commessa_id === selectedFolderId`; quindi confronta un `cliente_id` con un `commessa_id`.
Evidenza:
- `frontend/src/types/studio.ts:46`
- `frontend/src/context/StudioContext.tsx:174`
- `frontend/src/context/StudioContext.tsx:177`
- `frontend/src/components/studio/StudioListView.tsx:126`
- `frontend/src/components/studio/StudioListView.tsx:127`

### Cassa / Regole riconciliazione

43. `VERIFICATO` - Da UI non e configurabile l'aggancio automatico a una fattura passiva specifica, anche se schema e servizio lo supportano.
Motivo: il modello frontend/backend espone `fattura_passiva_id` e il servizio lo usa per valorizzare `mov.fattura_passiva_id`, ma il dialog frontend mostra solo pattern, categoria, priorita e fornitore.
Evidenza:
- `frontend/src/hooks/useRegoleRiconciliazione.ts:11`
- `frontend/src/pages/RegoleRiconciliazione.tsx:45`
- `frontend/src/pages/RegoleRiconciliazione.tsx:84`
- `frontend/src/pages/RegoleRiconciliazione.tsx:85`
- `frontend/src/pages/RegoleRiconciliazione.tsx:349`
- `backend/app/services/services.py:2124`
- `backend/app/services/services.py:2125`

### Settings

44. `VERIFICATO` - In `Account Settings` il campo `Password Corrente` e solo scenografico: il cambio password non la verifica davvero.
Motivo: il componente dichiara esplicitamente che in un backend reale andrebbe verificata, ma la mutation invia solo la nuova password.
Evidenza:
- `frontend/src/pages/settings/AccountSettings.tsx:47`
- `frontend/src/pages/settings/AccountSettings.tsx:50`

45. `VERIFICATO` - Il salvataggio preferenze notifiche invalida una query key non usata dall'auth corrente, quindi il dato utente puo restare stale.
Motivo: `NotificationSettings` invalida solo `["auth-me"]`, mentre `useAuth` legge il profilo dalla query `["user"]`.
Evidenza:
- `frontend/src/pages/settings/NotificationSettings.tsx:103`
- `frontend/src/hooks/useAuth.ts:19`

### Task Templates

46. `VERIFICATO` - La pagina `Task Templates` espone create/edit/delete anche a ruoli ERP che poi vengono bloccati dal backend.
Motivo: la route frontend e accessibile a tutti gli utenti ERP non studio-only, ma le mutation backend su template e generazione richiedono `ADMIN`, `DEVELOPER` o `PM`.
Evidenza:
- `frontend/src/App.tsx:145`
- `frontend/src/pages/TaskTemplatesPage.tsx:255`
- `frontend/src/pages/TaskTemplatesPage.tsx:262`
- `backend/app/api/v1/router.py:1565`
- `backend/app/api/v1/router.py:1569`
- `backend/app/api/v1/router.py:1591`
- `backend/app/api/v1/router.py:1596`
- `backend/app/api/v1/router.py:1628`
- `backend/app/api/v1/router.py:1632`
- `backend/app/api/v1/router.py:1648`

47. `VERIFICATO` - I `Task Templates` permettono di salvare item senza titolo e poi generano task con titolo vuoto.
Motivo: il frontend consente il salvataggio finche il nome template esiste, anche se alcune righe hanno `titolo=""`; il backend accetta gli item raw e la generazione usa `item.titolo` direttamente per creare `Task`.
Evidenza:
- `frontend/src/pages/TaskTemplatesPage.tsx:140`
- `frontend/src/pages/TaskTemplatesPage.tsx:213`
- `frontend/src/pages/TaskTemplatesPage.tsx:214`
- `backend/app/api/v1/router.py:1565`
- `backend/app/api/v1/router.py:1578`
- `backend/app/api/v1/router.py:1687`
- `backend/app/api/v1/router.py:1695`

### Studio Team

48. `VERIFICATO` - La vista `Studio Team` puo mostrare un falso stato vuoto ai ruoli non admin.
Motivo: `Studio OS` e accessibile a tutti gli utenti autenticati, ma `StudioTeamView` legge `/users`, che lato backend richiede `require_admin`; in errore il componente cade sul fallback `users=[]` e mostra `Nessun membro nel team`.
Evidenza:
- `frontend/src/App.tsx:117`
- `frontend/src/components/studio/StudioTeamView.tsx:36`
- `frontend/src/components/studio/StudioTeamView.tsx:58`
- `frontend/src/components/studio/StudioTeamView.tsx:59`
- `backend/app/api/v1/users.py:36`
- `backend/app/api/v1/users.py:40`

49. `VERIFICATO` - In `Studio Team` il bottone `Nuovo Membro` e il flow di modifica sono esposti anche se il backend `/risorse` e admin-only.
Motivo: la view non fa gating per ruolo e apre `CollaboratorForm`, ma create/patch risorsa in backend richiedono `require_admin`.
Evidenza:
- `frontend/src/components/studio/StudioTeamView.tsx:87`
- `frontend/src/components/studio/StudioTeamView.tsx:113`
- `frontend/src/components/collaboratori/CollaboratorForm.tsx:136`
- `backend/app/api/v1/router.py:764`
- `backend/app/api/v1/router.py:768`
- `backend/app/api/v1/router.py:774`
- `backend/app/api/v1/router.py:779`

50. `VERIFICATO` - La modifica collaboratore da `Studio Team` usa un `User` come se fosse una `Risorsa`, quindi il patch puo puntare all'ID sbagliato.
Motivo: `StudioTeamView` prende dati da `useUsers()` e passa `selectedCollaborator: User` al `CollaboratorForm`, che in edit chiama `/risorse/${collaborator.id}` assumendo invece un ID risorsa.
Evidenza:
- `frontend/src/components/studio/StudioTeamView.tsx:36`
- `frontend/src/components/studio/StudioTeamView.tsx:40`
- `frontend/src/components/studio/StudioTeamView.tsx:101`
- `frontend/src/components/studio/StudioTeamView.tsx:113`
- `frontend/src/hooks/useUsers.ts:9`
- `frontend/src/components/collaboratori/CollaboratorForm.tsx:58`
- `frontend/src/components/collaboratori/CollaboratorForm.tsx:134`
- `backend/app/api/v1/router.py:774`

### Notifiche

51. `VERIFICATO` - Nel dropdown notifiche della topbar il bottone `Vedi tutte le attivita` e esposto ma non ha alcuna azione collegata.
Evidenza:
- `frontend/src/components/layout/NotificationDropdown.tsx:129`
- `frontend/src/components/layout/NotificationDropdown.tsx:130`

52. `VERIFICATO` - Nel centro notifiche di Studio OS il bottone `Mostra archivio completo` e esposto ma non ha alcuna azione collegata.
Evidenza:
- `frontend/src/components/studio/StudioTopbar.tsx:18`
- `frontend/src/components/studio/StudioTopbar.tsx:227`
- `frontend/src/components/notifications/NotificationCenter.tsx:131`
- `frontend/src/components/notifications/NotificationCenter.tsx:133`

### Cliente Detail

53. `VERIFICATO` - Il filtro periodo nello `Storico Commesse` del cliente non filtra davvero la tabella.
Motivo: la select aggiorna `periodo` e calcola `filteredCommesse`, ma la tabella renderizza `commesse.map(...)` invece di usare l'array filtrato.
Evidenza:
- `frontend/src/pages/ClienteDetail.tsx:95`
- `frontend/src/pages/ClienteDetail.tsx:119`
- `frontend/src/pages/ClienteDetail.tsx:443`
- `frontend/src/pages/ClienteDetail.tsx:469`

### Progetto Detail

54. `VERIFICATO` - La card `Commesse Correlate` della scheda progetto non mostra davvero le commesse collegate.
Motivo: la pagina controlla solo la prima commessa del mese corrente del cliente e, anche quando trova un link attivo, il contenuto della card renderizza comunque sempre lo stato vuoto `Nessuna commessa registrata`.
Evidenza:
- `frontend/src/pages/ProgettoDetail.tsx:46`
- `frontend/src/pages/ProgettoDetail.tsx:47`
- `frontend/src/pages/ProgettoDetail.tsx:85`
- `frontend/src/pages/ProgettoDetail.tsx:86`
- `frontend/src/pages/ProgettoDetail.tsx:332`
- `frontend/src/pages/ProgettoDetail.tsx:343`
- `frontend/src/pages/ProgettoDetail.tsx:348`

55. `VERIFICATO` - La card `Analisi Redditivita` del progetto mostra una `Capacita Utilizzata` fittizia.
Motivo: il testo mostra sempre `0 / delivery_attesa h` e la barra e hardcoded a larghezza zero, quindi non usa ore reali o timesheet del progetto.
Evidenza:
- `frontend/src/pages/ProgettoDetail.tsx:364`
- `frontend/src/pages/ProgettoDetail.tsx:365`
- `frontend/src/pages/ProgettoDetail.tsx:368`

56. `VERIFICATO` - Lo `Stato Margine` nel dettaglio progetto e hardcoded su `OTTIMALE`.
Motivo: il badge viene renderizzato staticamente senza alcun ramo basato su costi, ore o margine effettivo.
Evidenza:
- `frontend/src/pages/ProgettoDetail.tsx:407`
- `frontend/src/pages/ProgettoDetail.tsx:410`

### Chat Progetto

57. `VERIFICATO` - La ricerca nella `Chat Progetto` non e limitata al progetto aperto.
Motivo: il pannello di ricerca della chat progetto chiama `/chat/search?q=...`, ma il backend cerca in tutti i canali di cui l'utente e membro, non nel solo canale/progetto corrente.
Evidenza:
- `frontend/src/components/chat/ChatProgetto.tsx:98`
- `frontend/src/components/chat/ChatProgetto.tsx:103`
- `backend/app/api/v1/chat.py:682`
- `backend/app/api/v1/chat.py:688`
- `backend/app/api/v1/chat.py:693`

58. `VERIFICATO` - I risultati della ricerca nella `Chat Progetto` sembrano cliccabili ma non fanno nulla.
Motivo: ogni card risultato usa `cursor-pointer` e hover, ma non ha `onClick`, nessun jump al messaggio e nessuna navigazione al contesto del risultato.
Evidenza:
- `frontend/src/components/chat/ChatProgetto.tsx:270`
- `frontend/src/components/chat/ChatProgetto.tsx:271`
- `frontend/src/components/chat/ChatProgetto.tsx:276`

### Progetti

59. `VERIFICATO` - L'azione `Nuovo Progetto` dallo stato vuoto della tabella progetti punta a un intent URL che la pagina non legge.
Motivo: `ProgettoTable` naviga a `/progetti?action=new`, ma `ProgettiPage` non usa `useSearchParams` e apre il dialog solo da stato locale.
Evidenza:
- `frontend/src/components/progetti/ProgettoTable.tsx:117`
- `frontend/src/components/progetti/ProgettoTable.tsx:122`
- `frontend/src/pages/Progetti.tsx:18`
- `frontend/src/pages/Progetti.tsx:22`
- `frontend/src/pages/Progetti.tsx:73`

60. `VERIFICATO` - Il `ProgettoDialog` usa un endpoint admin-only per popolare il team, anche se la gestione progetti e accessibile a tutti i ruoli ERP.
Motivo: il dialog legge i collaboratori con `useUsers()` -> `GET /users`, ma il backend protegge `/users` con `require_admin`; la route `/progetti` invece e solo `require_erp_access`.
Evidenza:
- `frontend/src/App.tsx:132`
- `frontend/src/components/progetti/ProgettoDialog.tsx:38`
- `frontend/src/components/progetti/ProgettoDialog.tsx:73`
- `frontend/src/hooks/useUsers.ts:5`
- `frontend/src/hooks/useUsers.ts:9`
- `backend/app/api/v1/users.py:36`
- `backend/app/api/v1/users.py:40`
- `backend/app/api/v1/progetti.py:90`
- `backend/app/api/v1/progetti.py:94`

### Pianificazione

61. `VERIFICATO` - La sezione `Pianificazioni` sotto `Commesse` e esposta a tutti gli utenti ERP, ma le API di pianificazione sono limitate a `ADMIN`, `DEVELOPER` e `PM`.
Motivo: la route `/commesse` e disponibile a tutti gli utenti ERP non studio-only, la tab e il dialog di pianificazione sono sempre renderizzati, ma list/create/update/approve/convert lato backend richiedono ruoli elevati.
Evidenza:
- `frontend/src/App.tsx:134`
- `frontend/src/pages/Commesse.tsx:177`
- `frontend/src/pages/Commesse.tsx:200`
- `frontend/src/pages/Commesse.tsx:223`
- `backend/app/api/v1/pianificazioni.py:36`
- `backend/app/api/v1/pianificazioni.py:41`
- `backend/app/api/v1/pianificazioni.py:59`
- `backend/app/api/v1/pianificazioni.py:63`
- `backend/app/api/v1/pianificazioni.py:77`
- `backend/app/api/v1/pianificazioni.py:82`
- `backend/app/api/v1/pianificazioni.py:98`
- `backend/app/api/v1/pianificazioni.py:102`
- `backend/app/api/v1/pianificazioni.py:116`
- `backend/app/api/v1/pianificazioni.py:121`

62. `VERIFICATO` - Il `PlanningDialog` dipende da `/users` admin-only per scegliere i collaboratori, quindi anche un PM autorizzato alla pianificazione puo trovarsi con selettore risorse vuoto o in errore.
Motivo: la UI pianificazioni usa `useUsers(true)` per la select collaboratori, ma il backend `/users` richiede `require_admin`, mentre le API pianificazioni accettano anche `PM`.
Evidenza:
- `frontend/src/components/planning/PlanningDialog.tsx:31`
- `frontend/src/components/planning/PlanningDialog.tsx:75`
- `frontend/src/components/planning/PlanningDialog.tsx:330`
- `frontend/src/hooks/useUsers.ts:5`
- `frontend/src/hooks/useUsers.ts:9`
- `backend/app/api/v1/users.py:36`
- `backend/app/api/v1/users.py:40`
- `backend/app/api/v1/pianificazioni.py:59`
- `backend/app/api/v1/pianificazioni.py:63`

63. `VERIFICATO` - L'azione `Elimina` nelle pianificazioni puo essere mostrata anche a ruoli che il backend non autorizza davvero.
Motivo: la tabella mostra `Elimina` per ogni piano non convertito senza controllo ruolo, ma il backend consente la delete solo a `ADMIN` e `DEVELOPER`, non a `PM`.
Evidenza:
- `frontend/src/components/planning/PlanningTable.tsx:196`
- `frontend/src/components/planning/PlanningTable.tsx:202`
- `frontend/src/pages/Commesse.tsx:210`
- `backend/app/api/v1/pianificazioni.py:153`
- `backend/app/api/v1/pianificazioni.py:157`

### Commesse

64. `VERIFICATO` - Il bottone finale del `CommessaDialog` promette `Apri Commessa`, ma il create flow non apre alcun dettaglio.
Motivo: il submit crea la commessa, mostra toast e chiude il dialog; l'oggetto restituito dal hook contiene l'ID ma non viene usato per navigare.
Evidenza:
- `frontend/src/components/commesse/CommessaDialog.tsx:198`
- `frontend/src/components/commesse/CommessaDialog.tsx:204`
- `frontend/src/components/commesse/CommessaDialog.tsx:207`
- `frontend/src/components/commesse/CommessaDialog.tsx:523`
- `frontend/src/hooks/useCommesse.ts:39`
- `frontend/src/hooks/useCommesse.ts:43`

### Planning

65. `VERIFICATO` - La board Planning usa `risorsa.id` dove il flusso richiede `user_id`, rompendo assegnazioni, carico e assenze.
Motivo: il componente dichiara entrambe le chiavi (`id` e `user_id`) ma usa `risorsa.id` per costruire le celle, filtrare `task.assegnatario_id`, calcolare il carico, leggere le assenze e inviare il `userId` a `/planning/assign`; lato backend pero `Task.assegnatario_id` e una FK verso `users.id`.
Evidenza:
- `frontend/src/pages/Planning.tsx:67`
- `frontend/src/pages/Planning.tsx:69`
- `frontend/src/pages/Planning.tsx:214`
- `frontend/src/pages/Planning.tsx:216`
- `frontend/src/pages/Planning.tsx:223`
- `frontend/src/pages/Planning.tsx:236`
- `frontend/src/pages/Planning.tsx:245`
- `frontend/src/pages/Planning.tsx:252`
- `frontend/src/pages/Planning.tsx:255`
- `frontend/src/pages/Planning.tsx:263`
- `frontend/src/pages/Planning.tsx:275`
- `frontend/src/pages/Planning.tsx:478`
- `frontend/src/pages/Planning.tsx:479`
- `frontend/src/pages/Planning.tsx:481`
- `frontend/src/pages/Planning.tsx:485`
- `backend/app/api/v1/planning.py:99`
- `backend/app/api/v1/planning.py:102`
- `backend/app/api/v1/planning.py:116`
- `backend/app/models/models.py:361`
- `backend/app/models/models.py:368`

66. `VERIFICATO` - La ricerca backlog nel Planning promette filtro per progetto, ma filtra solo il titolo task.
Motivo: il placeholder dice `Filtra per titolo o progetto...`, ma il filtro usa solo `t.titolo.toLowerCase()`; inoltre l'endpoint `/planning/tasks` non restituisce alcun nome progetto, solo `progetto_id`.
Evidenza:
- `frontend/src/pages/Planning.tsx:190`
- `frontend/src/pages/Planning.tsx:192`
- `frontend/src/pages/Planning.tsx:636`
- `backend/app/api/v1/planning.py:33`
- `backend/app/api/v1/planning.py:40`

67. `VERIFICATO` - Le card backlog grandi del Planning mostrano un sottotitolo placeholder fisso invece del nome progetto reale.
Motivo: per ogni task con `progetto_id` il componente renderizza sempre la stringa hardcoded `Analisi Project X`.
Evidenza:
- `frontend/src/pages/Planning.tsx:818`
- `frontend/src/pages/Planning.tsx:821`

### Finance / Imputazioni

68. `VERIFICATO` - Il drawer `Imputa Costi` supporta il campo `note` nel modello ma non offre alcun input per modificarlo.
Motivo: `ImputazioneForm` include `note`, le note esistenti vengono caricate e il payload le reinvia al backend, ma nella UI delle righe sono renderizzati solo `Tipo`, `Percentuale`, `Cliente` e `Progetto`.
Evidenza:
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:37`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:42`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:45`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:54`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:59`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:156`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:161`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:202`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:255`

69. `VERIFICATO` - Il drawer `Imputa Costi` permette di salvare imputazioni incomplete sotto il 100%.
Motivo: la UI segnala `mancano X%`, ma blocca solo il caso `>100`; il pulsante `Salva Imputazioni` resta attivo anche con totale parziale e il backend salva le righe senza validare che la somma arrivi a 100%.
Evidenza:
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:137`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:138`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:151`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:152`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:177`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:187`
- `frontend/src/components/finance/ImputazioneCostiDrawer.tsx:270`
- `backend/app/services/services.py:2286`
- `backend/app/services/services.py:2300`
- `backend/app/services/services.py:2314`
- `backend/app/services/services.py:2338`
- `backend/app/services/services.py:2376`
- `backend/app/services/services.py:2389`

### Planning / Task Dialog

70. `VERIFICATO` - Il `TaskPlanningDialog` ha una `descrizione` nel modello ma la modale non la espone.
Motivo: schema, default state, reset in edit e payload create/update includono `descrizione`, ma nel form renderizzato non esiste nessun campo dedicato; l'utente puo quindi creare o modificare solo titolo, progetto e stima.
Evidenza:
- `frontend/src/components/planning/TaskPlanningDialog.tsx:33`
- `frontend/src/components/planning/TaskPlanningDialog.tsx:37`
- `frontend/src/components/planning/TaskPlanningDialog.tsx:56`
- `frontend/src/components/planning/TaskPlanningDialog.tsx:60`
- `frontend/src/components/planning/TaskPlanningDialog.tsx:66`
- `frontend/src/components/planning/TaskPlanningDialog.tsx:70`
- `frontend/src/components/planning/TaskPlanningDialog.tsx:82`
- `frontend/src/components/planning/TaskPlanningDialog.tsx:86`
- `frontend/src/components/planning/TaskPlanningDialog.tsx:88`
- `frontend/src/components/planning/TaskPlanningDialog.tsx:108`
- `frontend/src/components/planning/TaskPlanningDialog.tsx:162`
- `backend/app/schemas/schemas.py:653`
- `backend/app/schemas/schemas.py:660`
- `backend/app/schemas/schemas.py:673`
- `backend/app/schemas/schemas.py:680`

### Contenuti

71. `VERIFICATO` - Per i ruoli contenuto-limitati, `Nuovo Contenuto` aperto da una commessa mostra una commessa impostata ma crea un contenuto scollegato.
Motivo: `defaultCommessaId` precompila il form e il riepilogo read-only mostra `Commessa impostata dal contesto corrente`, ma in create il payload omette `commessa_id` quando `canManageContent=false`; lato backend quei ruoli possono creare nuovi contenuti solo senza scope, quindi il record viene salvato senza commessa.
Evidenza:
- `frontend/src/pages/CommessaDetail.tsx:1165`
- `frontend/src/pages/CommessaDetail.tsx:1168`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:56`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:60`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:93`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:100`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:176`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:178`
- `backend/app/api/v1/router.py:1959`
- `backend/app/api/v1/router.py:1967`
- `backend/app/api/v1/router.py:1969`
- `backend/app/api/v1/router.py:1974`
- `backend/app/core/content_pipeline_rules.py:186`
- `backend/app/core/content_pipeline_rules.py:191`

72. `VERIFICATO` - Il `ContenutoDialog` non espone mai il collegamento a `progetto`, anche se modello e API lo supportano.
Motivo: il tipo frontend e le API backend gestiscono `progetto_id`, ma lo stato del form non lo contiene, il payload non lo invia e la modale offre solo `Commessa` e `Assegnatario`.
Evidenza:
- `frontend/src/hooks/useContenuti.ts:24`
- `frontend/src/hooks/useContenuti.ts:25`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:45`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:54`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:93`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:101`
- `frontend/src/components/contenuti/ContenutoDialog.tsx:169`
- `backend/app/api/v1/router.py:1968`
- `backend/app/api/v1/router.py:1983`
- `backend/app/api/v1/router.py:2050`
- `backend/app/api/v1/router.py:2058`
- `backend/app/api/v1/router.py:2070`

### AI / Commesse

73. `VERIFICATO` - La generazione `Genera con AI` in una commessa con piu progetti collega tutti i task al primo progetto della commessa.
Motivo: la pagina costruisce il contesto AI usando tutti i `projectTypes` presenti nella commessa, ma passa al dialog solo `commessa.righe_progetto?.[0]?.progetto_id` come `defaultProjectId`; in creazione ogni task riusa sempre quel singolo `progetto_id`, senza selettore progetto.
Evidenza:
- `frontend/src/pages/CommessaDetail.tsx:126`
- `frontend/src/pages/CommessaDetail.tsx:127`
- `frontend/src/pages/CommessaDetail.tsx:130`
- `frontend/src/pages/CommessaDetail.tsx:131`
- `frontend/src/pages/CommessaDetail.tsx:1159`
- `frontend/src/pages/CommessaDetail.tsx:1161`
- `frontend/src/components/ai/AITaskGeneratorDialog.tsx:19`
- `frontend/src/components/ai/AITaskGeneratorDialog.tsx:25`
- `frontend/src/components/ai/AITaskGeneratorDialog.tsx:27`
- `frontend/src/components/ai/AITaskGeneratorDialog.tsx:118`
- `frontend/src/components/ai/AITaskGeneratorDialog.tsx:119`
- `frontend/src/components/ai/AITaskGeneratorDialog.tsx:120`

## Note operative

- Le aree protette sono ora verificabili in locale: e stato confermato un login funzionante contro il backend attivo.
- Il report verra aggiornato progressivamente durante i controlli per piccole sezioni.
