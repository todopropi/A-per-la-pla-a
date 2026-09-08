/**
 * temari_pl_config.js
 * Configuració oficial dels temaris per municipi de Policia Local
 * i sistema de correspondències per a matèries comunes / compartides.
 */

(function () {
  'use strict';

  // 1. Matèries comunes troncals (Transversals a tot Catalunya)
  const MATERIES_COMPARTIDES = [
    {
      id: 'constitucio',
      nom: 'Constitució Espanyola de 1978 i Tribunal Constitucional',
      descripcio: 'Estructura, drets i deures fonamentals, garanties, suspensió de drets, Defensor del Poble i Poder Judicial / TC.',
      concordances: {
        'Constantí': 'Temes 1 i 2',
        'Cubelles': 'Temes 1, 2, 3 i 23',
        'Cunit': 'Temes B.5, B.7 i B.10'
      }
    },
    {
      id: 'estatut',
      nom: 'Estatut d’Autonomia i Institucions de Catalunya',
      descripcio: 'Estructura, continguts essencials, competències exclusives i executives de la Generalitat, Parlament i Govern.',
      concordances: {
        'Constantí': 'Tema 3',
        'Cubelles': 'Temes 7, 8 i 9',
        'Cunit': 'Temes B.1 i B.2'
      }
    },
    {
      id: 'regim_local',
      nom: 'Organització Territorial, Règim Local i Municipis',
      descripcio: 'El municipi: organització, població, competències, reglaments municipals, ordenances i bans (Llei 7/1985).',
      concordances: {
        'Constantí': 'Temes 4, 7 i 29',
        'Cubelles': 'Temes 5, 6, 10 i 37',
        'Cunit': 'Temes B.6, B.8, B.11, B.12, B.13, D.1 i D.2'
      }
    },
    {
      id: 'procediment_administratiu',
      nom: 'Administració Pública i Procediment Administratiu (LPAC)',
      descripcio: 'Principis d’actuació, fonts del dret, actes administratius, recursos, fases del procediment (Llei 39/2015) i pressupost.',
      concordances: {
        'Constantí': 'Temes 5, 6, 8, 9, 10, 11, 12 i 26',
        'Cubelles': 'Tema 4',
        'Cunit': 'Tema B.4'
      }
    },
    {
      id: 'disciplinari_incompatibilitats',
      nom: 'Funció Pública, Règim Disciplinari i Incompatibilitats',
      descripcio: 'Estatut dels empleats públics, Decret 179/2015 (Règim disciplinari Policia Local) i Llei 53/1984 d’incompatibilitats.',
      concordances: {
        'Constantí': 'Temes 13, 14 i 30',
        'Cubelles': 'Temes 21 i 22',
        'Cunit': 'Temes B.14, B.15, B.16 i C.11'
      }
    },
    {
      id: 'transparencia_dades',
      nom: 'Transparència i Protecció de Dades Personals',
      descripcio: 'Llei 19/2014 de transparència i accés a la informació pública; RGPD i Llei Orgànica 3/2018 de protecció de dades.',
      concordances: {
        'Constantí': 'Temes 15 i 16',
        'Cubelles': 'Tema 3',
        'Cunit': 'Tema B.5'
      }
    },
    {
      id: 'llei_16_1991',
      nom: 'Llei 16/1991 de les Policies Locals de Catalunya',
      descripcio: 'Marc regulador de les policies locals: creació, funcions, principis d’actuació, drets, deures i coordinació policial.',
      concordances: {
        'Constantí': 'Tema 17',
        'Cubelles': 'Temes 20 i 21',
        'Cunit': 'Temes C.3 i D.3'
      }
    },
    {
      id: 'forces_cossos',
      nom: 'Forces i Cossos de Seguretat (Llei Orgànica 2/1986)',
      descripcio: 'Principis bàsics d’actuació, forces estatals (CNP, Guàrdia Civil), policies autonòmiques i policies locals.',
      concordances: {
        'Constantí': 'Tema 20',
        'Cubelles': 'Temes 18 i 19',
        'Cunit': 'Tema C.8'
      }
    },
    {
      id: 'seguretat_ciutadana',
      nom: 'Protecció de la Seguretat Ciutadana (Llei Orgànica 4/2015)',
      descripcio: 'Documentació, identificació personal, controls preventius, escorcolls, actuacions de manteniment i règim sancionador.',
      concordances: {
        'Constantí': 'Temes 18 i 19',
        'Cubelles': 'Tema 31',
        'Cunit': 'Tema C.4'
      }
    },
    {
      id: 'seguretat_publica',
      nom: 'Sistema de Seguretat Pública de Catalunya (Llei 4/2003)',
      descripcio: 'Estructura del sistema, juntes locals de seguretat, convenis de col·laboració, meses operatives i relació ciutadana.',
      concordances: {
        'Constantí': 'Temes 27, 28 i 34',
        'Cubelles': 'Temes 13, 15, 16 i 17',
        'Cunit': 'Temes B.3, C.1, C.2, C.9 i C.10'
      }
    },
    {
      id: 'codi_penal',
      nom: 'Codi Penal, Delictes i Jurisdicció Penal',
      descripcio: 'Delictes contra persones, patrimoni, ordre públic, seguretat viària, delictes comesos per funcionaris i òrgans judicials penals.',
      concordances: {
        'Constantí': 'Temes 21, 22, 23, 24, 25 i 39',
        'Cubelles': 'Tema 24',
        'Cunit': 'Tema C.5'
      }
    },
    {
      id: 'transit',
      nom: 'Trànsit, Circulació de Vehicles i Conductors',
      descripcio: 'Reglament General de Circulació, Reglament General de Conductors, normativa viària, autoritzacions i procediment sancionador.',
      concordances: {
        'Constantí': 'Temes 32 i 33',
        'Cubelles': 'Temes 32, 33 i 34',
        'Cunit': 'Tema C.6'
      }
    },
    {
      id: 'accidents_transit',
      nom: 'Accidents de Trànsit i Alcoholèmies',
      descripcio: 'Investigació i atestats per accident, diligències per conducció sota efectes de begudes alcohòliques o estupefaents.',
      concordances: {
        'Constantí': 'Tema 37',
        'Cubelles': 'Temes 35 i 36',
        'Cunit': 'Tema C.6'
      }
    },
    {
      id: 'detencions',
      nom: 'Detencions, Drets del Detingut i Entrada a Domicili',
      descripcio: 'Marc legal de la detenció (LECrim), qui pot/ha de detenir, terminis, drets del detingut, menors, habeas corpus i entrada domiciliària.',
      concordances: {
        'Constantí': 'Tema 36',
        'Cubelles': 'Temes 27, 28 i 29',
        'Cunit': 'Tema C.4'
      }
    },
    {
      id: 'atestat_policial',
      nom: 'L’Atestat Policial, Informes i Denúncies',
      descripcio: 'Estructura bàsica de l’atestat, valor probatori, obligació i dret de denunciar, efectes legals, actes i comunicacions.',
      concordances: {
        'Constantí': 'Tema 40',
        'Cubelles': 'Temes 25 i 26',
        'Cunit': 'Tema C.12'
      }
    },
    {
      id: 'codi_etica',
      nom: 'Codi d’Ètica i Deontologia Policial',
      descripcio: 'Codi d’ètica de la Policia de Catalunya: principis, ús de la força, resolució pacífica de conflictes i tracte a testimonis/víctimes.',
      concordances: {
        'Constantí': 'Tema 31',
        'Cubelles': 'Tema 14',
        'Cunit': 'Tema C.7'
      }
    },
    {
      id: 'unio_europea',
      nom: 'La Unió Europea i Institucions Comunitàries',
      descripcio: 'Principals institucions comunitàries (Comissió, Consell, Parlament), òrgans jurisdiccionals (TJUE) i tipologia de normes (Directives, Reglaments).',
      concordances: {
        'Constantí': 'Dret comú',
        'Cubelles': 'Temes 11 i 12',
        'Cunit': 'Tema B.9'
      }
    }
  ];

  // 2. Configuració oficial per municipi segons bases de convocatòria
  const TEMARIS_MUNICIPALS = {
    'Constantí': {
      nom: 'Constantí',
      referencia: 'BOPT 31-8-2026',
      descripcio: 'Convocatòria oficial Policia Local Constantí (38 temes de legislació comuna + 2 temes locals específics).',
      temes: [
        { id: '1', codi: 'T1', nom: "La Constitució espanyola de 1978: estructura i contingut. Principis generals. La reforma de la constitució. El Tribunal Constitucional.", materia: 'constitucio' },
        { id: '2', codi: 'T2', nom: "Drets i deures fonamentals dels espanyols. Garanties i suspensió dels drets i llibertats fonamentals. El Defensor del poble.", materia: 'constitucio' },
        { id: '3', codi: 'T3', nom: "Organització territorial de l’Estat (I): Les Comunitats Autònomes. L’Estatut d’Autonomia de Catalunya: estructura, continguts essencials i principis fonamentals. La Generalitat: competències exclusives, de desenvolupament legislatiu i executives.", materia: 'estatut' },
        { id: '4', codi: 'T4', nom: "Organització territorial de l’Estat (II): El municipi i la seva regulació jurídica. Organització i competències.", materia: 'regim_local' },
        { id: '5', codi: 'T5', nom: "L’Administració pública: principis d’actuació a l’Administració Pública: eficàcia, jerarquia, descentralització, desconcentració i coordinació.", materia: 'procediment_administratiu' },
        { id: '6', codi: 'T6', nom: "Submissió de l’Administració a la Llei i al Dret: Fonts del Dret Públic. La llei: classes de llei. El Reglament: concepte i classes.", materia: 'procediment_administratiu' },
        { id: '7', codi: 'T7', nom: "Les ordenances i els bans. Concepte. Règim d’aprovació. Destinataris. Control del seu compliment.", materia: 'regim_local' },
        { id: '8', codi: 'T8', nom: "L’acte administratiu: concepte, classes i elements. La motivació i la forma.", materia: 'procediment_administratiu' },
        { id: '9', codi: 'T9', nom: "Els ciutadans davant l’Administració: drets i col·laboració.", materia: 'procediment_administratiu' },
        { id: '10', codi: 'T10', nom: "El procediment administratiu: principis generals. Les fases del procediment administratiu.", materia: 'procediment_administratiu' },
        { id: '11', codi: 'T11', nom: "Els recursos administratius: Objectes i classes.", materia: 'procediment_administratiu' },
        { id: '12', codi: 'T12', nom: "El pressupost municipal: Concepte, estructura i regulació.", materia: 'procediment_administratiu' },
        { id: '13', codi: 'T13', nom: "El règim d’incompatibilitats del personal al servei de les administracions públiques.", materia: 'disciplinari_incompatibilitats' },
        { id: '14', codi: 'T14', nom: "Règim disciplinari dels funcionaris públics pertanyents a un cos de Policia Local.", materia: 'disciplinari_incompatibilitats' },
        { id: '15', codi: 'T15', nom: "Línies bàsiques sobre transparència i informació pública.", materia: 'transparencia_dades' },
        { id: '16', codi: 'T16', nom: "El dret a la protecció de dades com a dret fonamental.", materia: 'transparencia_dades' },
        { id: '17', codi: 'T17', nom: "Llei 16/1991, de 10 de juliol, de les Policies Locals de Catalunya (I): Títol 1, De les policies locals i llurs funcions.", materia: 'llei_16_1991' },
        { id: '18', codi: 'T18', nom: "Llei orgànica 4/2015, de 30 de març, de Protecció de la Seguretat Ciutadana (I): Capítol I: Disposicions generals. Capítol II. Documentació i identificació personal.", materia: 'seguretat_ciutadana' },
        { id: '19', codi: 'T19', nom: "Llei orgànica 4/2015, de 30 de març, de Protecció de la Seguretat Ciutadana (II): Capítol III, Actuacions per al manteniment i restabliment de la seguretat ciutadana.", materia: 'seguretat_ciutadana' },
        { id: '20', codi: 'T20', nom: "Llei Orgànica 2/1986 de 13 de març de Forces i Cossos de Seguretat. Definició de forces o cossos de seguretat pública. Les policies locals.", materia: 'forces_cossos' },
        { id: '21', codi: 'T21', nom: "Codi Penal (I): Delictes contra les persones: homicidi i les seves formes; les lesions; delictes contra la llibertat; delictes contra la llibertat sexual; delictes contra la intimitat, el dret a la pròpia imatge i la inviolabilitat del domicili; delictes contra l’honor; delictes contra les relacions familiars.", materia: 'codi_penal' },
        { id: '22', codi: 'T22', nom: "Codi Penal (II): Delictes contra el patrimoni: el furt i robatori; l’extorsió; el robatori i el furt d’ús de vehicles; la usurpació; l’estafa i l’apropiació indeguda; els danys.", materia: 'codi_penal' },
        { id: '23', codi: 'T23', nom: "Codi Penal (III): Delictes contra la seguretat del trànsit.", materia: 'codi_penal' },
        { id: '24', codi: 'T24', nom: "Codi Penal (IV): Delictes contra l’ordre públic: atemptat, resistència i desobediència. Els desordres públics.", materia: 'codi_penal' },
        { id: '25', codi: 'T25', nom: "Codi penal (V): Delictes comesos pel funcionariat públic contra les garanties constitucionals i contra l’administració pública.", materia: 'codi_penal' },
        { id: '26', codi: 'T26', nom: "Llei 39/2015, d’1 d’octubre, del Procediment Administratiu Comú de les Administracions Públiques (II): Títol II, De l’activitat de les Administracions Públiques (articles 13 i 18). Títol III, dels actes administratius (articles 34 i 35).", materia: 'procediment_administratiu' },
        { id: '27', codi: 'T27', nom: "Llei 4/2003 (I) de 7 d'abril, d’ Ordenació del Sistema de Seguretat Pública de Catalunya: Capítol I, Disposicions generals. Capítol II, Estructura del sistema de seguretat. Capítol V, Relacions amb els ciutadans.", materia: 'seguretat_publica' },
        { id: '28', codi: 'T28', nom: "Llei 4/2003, de 7 d’abril, d’ordenació del sistema de seguretat pública de Catalunya (II): Les juntes locals de seguretat. Funcions. Les Meses de Coordinació operatives.", materia: 'seguretat_publica' },
        { id: '29', codi: 'T29', nom: "Llei 7/1985, de 2 d’abril, Reguladora de les bases del règim local. Títol I. Disposicions generals. Títol II. El municipi.", materia: 'regim_local' },
        { id: '30', codi: 'T30', nom: "El Decret 179/2015, de 4 d'agost, pel qual s'aprova el Reglament del procediment del règim disciplinari aplicable als cossos de Policia local de Catalunya.", materia: 'disciplinari_incompatibilitats' },
        { id: '31', codi: 'T31', nom: "El Codi d’ètica de la Policia de Catalunya: Actuació de la Policia. Àmbits d’aplicació: resolució de conflictes i ús de la força, investigació, detenció i privació de llibertat, atenció a les víctimes i testimonis.", materia: 'codi_etica' },
        { id: '32', codi: 'T32', nom: "El Reglament General de Circulació (I): Títol Preliminar. Títol I, Normes generals de comportament en la circulació.", materia: 'transit' },
        { id: '33', codi: 'T33', nom: "El Reglament General de Conductors: Títol I, De les autoritzacions administratives, Capítol 1, Del permís i de la llicència de conducció.", materia: 'transit' },
        { id: '34', codi: 'T34', nom: "Resolució INT/2344/2019, de 5 de setembre, per la qual s'aprova i es dona publicitat al Protocol per a l'abordatge de les infraccions d'odi i discriminació per a les policies locals de Catalunya.", materia: 'seguretat_publica' },
        { id: '35', codi: 'T35', nom: "Ordenança Municipal de Convivència Ciutadana a la Via Pública (Constantí).", materia: 'especific_constanti_ordenances', especific: true },
        { id: '36', codi: 'T36', nom: "Les detencions. Qui pot i qui ha d’efectuar detencions i quines són les circumstàncies que permeten o obliguen a efectuar-les. Forma i durada de les detencions.", materia: 'detencions' },
        { id: '37', codi: 'T37', nom: "L’accident de trànsit. Atestats per accidents de trànsit. Alcoholèmies: normativa reguladora i procediment.", materia: 'accidents_transit' },
        { id: '38', codi: 'T38', nom: "Coneixement del municipi de Constantí (història, geografia, carrerer i equipaments).", materia: 'especific_constanti_coneixement', especific: true },
        { id: '39', codi: 'T39', nom: "La jurisdicció penal. Òrgans i competències.", materia: 'codi_penal' },
        { id: '40', codi: 'T40', nom: "L’atestat policial. Estructura. Valor dels atestats policials.", materia: 'atestat_policial' }
      ]
    },
    'Cubelles': {
      nom: 'Cubelles',
      referencia: 'BOP Barcelona 31-12-2024',
      descripcio: 'Convocatòria oficial Policia Local Cubelles (40 temes ordenats segons bases oficials BOPB 31-12-2024).',
      temes: [
        { id: '1', codi: 'T1', nom: "Constitució Espanyola de 1978: Estructura.", materia: 'constitucio' },
        { id: '2', codi: 'T2', nom: "Principis generals de la Constitució Espanyola de 1978.", materia: 'constitucio' },
        { id: '3', codi: 'T3', nom: "Els drets humans i els drets constitucionals: les garanties dels drets.", materia: 'constitucio' },
        { id: '4', codi: 'T4', nom: "L’ordenament jurídic de l’Estat. Tipologia normativa.", materia: 'procediment_administratiu' },
        { id: '5', codi: 'T5', nom: "L’organització territorial de l’Estat.", materia: 'regim_local' },
        { id: '6', codi: 'T6', nom: "Les institucions polítiques de l’Estat.", materia: 'constitucio' },
        { id: '7', codi: 'T7', nom: "L'Estatut d'autonomia de Catalunya; estructura, contingut essencial i principis fonamentals. Els procediments de reforma.", materia: 'estatut' },
        { id: '8', codi: 'T8', nom: "Les institucions polítiques de Catalunya.", materia: 'estatut' },
        { id: '9', codi: 'T9', nom: "L’organització territorial de Catalunya.", materia: 'estatut' },
        { id: '10', codi: 'T10', nom: "El Municipi: Organització, territori, i població.", materia: 'regim_local' },
        { id: '11', codi: 'T11', nom: "La Unió Europea: Principals institucions.", materia: 'unio_europea' },
        { id: '12', codi: 'T12', nom: "Òrgans jurisdiccionals de la Unió Europea i tipus de normes.", materia: 'unio_europea' },
        { id: '13', codi: 'T13', nom: "Llei 4/2003, d'ordenació del sistema de seguretat pública de Catalunya.", materia: 'seguretat_publica' },
        { id: '14', codi: 'T14', nom: "Codi deontològic policial.", materia: 'codi_etica' },
        { id: '15', codi: 'T15', nom: "Coordinació i col·laboració entre cossos policials: Normes bàsiques de coordinació i col·laboració.", materia: 'seguretat_publica' },
        { id: '16', codi: 'T16', nom: "Competències específiques i competències compartides dels diferents Cossos policials. Juntes locals de seguretat.", materia: 'seguretat_publica' },
        { id: '17', codi: 'T17', nom: "Les juntes locals de seguretat. Els convenis de col·laboració.", materia: 'seguretat_publica' },
        { id: '18', codi: 'T18', nom: "La llei orgànica de forces i cossos de seguretat de l’Estat (LO 2/1986). Principis bàsics d’actuació.", materia: 'forces_cossos' },
        { id: '19', codi: 'T19', nom: "Els diferents cossos policials a l’Estat espanyol.", materia: 'forces_cossos' },
        { id: '20', codi: 'T20', nom: "Estructura, organització i funcions de les policies locals: Llei 16/1991, de 10 de juliol, de les policies locals.", materia: 'llei_16_1991' },
        { id: '21', codi: 'T21', nom: "Drets i deures dels membres de les policies locals.", materia: 'llei_16_1991' },
        { id: '22', codi: 'T22', nom: "El règim disciplinari aplicable als policies locals (Decret 179/2015).", materia: 'disciplinari_incompatibilitats' },
        { id: '23', codi: 'T23', nom: "El poder judicial: òrgans jurisdiccionals de l’Estat i el Tribunal Constitucional.", materia: 'constitucio' },
        { id: '24', codi: 'T24', nom: "El Codi penal: els delictes lleus i les penes. Persones responsables.", materia: 'codi_penal' },
        { id: '25', codi: 'T25', nom: "La denúncia: concepte i classes. El dret i el deure de denunciar. Efectes de la denúncia.", materia: 'atestat_policial' },
        { id: '26', codi: 'T26', nom: "L'atestat policial: estructura bàsica. Valor dels atestats policials.", materia: 'atestat_policial' },
        { id: '27', codi: 'T27', nom: "La detenció: concepte. Supòsits legals en què és procedent la detenció.", materia: 'detencions' },
        { id: '28', codi: 'T28', nom: "Els drets del detingut. La detenció de menors.", materia: 'detencions' },
        { id: '29', codi: 'T29', nom: "La entrada i registre de domicili.", materia: 'detencions' },
        { id: '30', codi: 'T30', nom: "La protecció del medi ambient. El delicte ecològic.", materia: 'medi_ambient' },
        { id: '31', codi: 'T31', nom: "Llei de Protecció de la seguretat ciutadana (Llei orgànica 4/2015, de 30 de març).", materia: 'seguretat_ciutadana' },
        { id: '32', codi: 'T32', nom: "Procediment sancionador en matèria de trànsit: normativa aplicable, autoritats competents, incoació.", materia: 'transit' },
        { id: '33', codi: 'T33', nom: "Procediment sancionador en matèria de trànsit: tipus de procediment, sancions i notificacions.", materia: 'transit' },
        { id: '34', codi: 'T34', nom: "Seguretat viària: normativa sobre trànsit, circulació de vehicles de motor i seguretat viària.", materia: 'transit' },
        { id: '35', codi: 'T35', nom: "Accidents de trànsit. Definició. Competències de la Policia Local. Tipus d’accident.", materia: 'accidents_transit' },
        { id: '36', codi: 'T36', nom: "La Conducció sota els efectes de begudes alcohòliques o estupefaents. Regulació i control. Delictes contra la seguretat vial.", materia: 'accidents_transit' },
        { id: '37', codi: 'T37', nom: "Policia administrativa: Principals infraccions a les ordenances municipals, denúncies i règim sancionador.", materia: 'regim_local' },
        { id: '38', codi: 'T38', nom: "Reglaments i Ordenances municipals de l'Ajuntament de Cubelles: organització municipal i funcionament.", materia: 'especific_cubelles', especific: true },
        { id: '39', codi: 'T39', nom: "Història, geografia, societat i cultura del municipi de Cubelles.", materia: 'especific_cubelles', especific: true },
        { id: '40', codi: 'T40', nom: "Principals festes i rutes turístiques, principals institucions municipals i edificis emblemàtics de Cubelles.", materia: 'especific_cubelles', especific: true }
      ]
    },
    'Cunit': {
      nom: 'Cunit',
      referencia: 'BOPT 2024 / 2025 (Annex 2)',
      descripcio: 'Convocatòria oficial Policia Local Cunit (40 temes estructurats en 4 blocs: Entorn, Institucional, Seguretat i Món Local).',
      blocs: [
        { id: 'Tots', nom: 'Tots els Blocs (40)' },
        { id: 'A', nom: "Bloc A: Coneixement de l'entorn (8)" },
        { id: 'B', nom: "Bloc B: Àmbit institucional (16)" },
        { id: 'C', nom: "Bloc C: Àmbit de seguretat i policia (12)" },
        { id: 'D', nom: "Bloc D: El món local a Catalunya (4)" }
      ],
      temes: [
        // Bloc A
        { id: 'A.1', codi: 'A.1', bloc: 'A', nom: "Història de Catalunya (part I): de la formació de Catalunya al segle XVIII.", materia: 'historia_catalunya' },
        { id: 'A.2', codi: 'A.2', bloc: 'A', nom: "Història de Catalunya (part II): la Catalunya contemporània (s. XIX i XX).", materia: 'historia_catalunya' },
        { id: 'A.3', codi: 'A.3', bloc: 'A', nom: "L’àmbit sociolingüístic.", materia: 'sociolinguistica' },
        { id: 'A.4', codi: 'A.4', bloc: 'A', nom: "Marc geogràfic de Catalunya i organització territorial.", materia: 'geografia_catalunya' },
        { id: 'A.5', codi: 'A.5', bloc: 'A', nom: "Principals variables de l'estructura econòmica i social de Catalunya.", materia: 'entorn_social' },
        { id: 'A.6', codi: 'A.6', bloc: 'A', nom: "El canvi social (part I): la societat multicultural, la igualtat d'oportunitats dels homes i les dones.", materia: 'canvi_social' },
        { id: 'A.7', codi: 'A.7', bloc: 'A', nom: "El canvi social (part II): les noves tecnologies de la informació.", materia: 'canvi_social' },
        { id: 'A.8', codi: 'A.8', bloc: 'A', nom: "El canvi social (part III): l'individu i l'equilibri ecològic.", materia: 'medi_ambient' },
        // Bloc B
        { id: 'B.1', codi: 'B.1', bloc: 'B', nom: "L'Estatut d'autonomia de Catalunya.", materia: 'estatut' },
        { id: 'B.2', codi: 'B.2', bloc: 'B', nom: "Les institucions polítiques de Catalunya.", materia: 'estatut' },
        { id: 'B.3', codi: 'B.3', bloc: 'B', nom: "El Departament d’Interior.", materia: 'seguretat_publica' },
        { id: 'B.4', codi: 'B.4', bloc: 'B', nom: "L'ordenament jurídic de l'Estat.", materia: 'procediment_administratiu' },
        { id: 'B.5', codi: 'B.5', bloc: 'B', nom: "Els drets humans i els drets constitucionals: les garanties dels drets.", materia: 'constitucio' },
        { id: 'B.6', codi: 'B.6', bloc: 'B', nom: "Les institucions polítiques de l'Estat.", materia: 'constitucio' },
        { id: 'B.7', codi: 'B.7', bloc: 'B', nom: "Els òrgans jurisdiccionals: el poder judicial i el Tribunal Constitucional.", materia: 'constitucio' },
        { id: 'B.8', codi: 'B.8', bloc: 'B', nom: "L'organització territorial de l'Estat.", materia: 'regim_local' },
        { id: 'B.9', codi: 'B.9', bloc: 'B', nom: "La Unió Europea.", materia: 'unio_europea' },
        { id: 'B.10', codi: 'B.10', bloc: 'B', nom: "La Constitució Espanyola de 1978: estructura i contingut general.", materia: 'constitucio' },
        { id: 'B.11', codi: 'B.11', bloc: 'B', nom: "L´organització política de l´Estat. L´organització territorial de l´Estat. Les Comunitats Autònomes.", materia: 'regim_local' },
        { id: 'B.12', codi: 'B.12', bloc: 'B', nom: "El municipi. Territori i població. Organització. Competències.", materia: 'regim_local' },
        { id: 'B.13', codi: 'B.13', bloc: 'B', nom: "Reglaments municipals: ordenances i bans.", materia: 'regim_local' },
        { id: 'B.14', codi: 'B.14', bloc: 'B', nom: "La funció pública. Règim jurídic, Concepte i classes d´empleats públics.", materia: 'disciplinari_incompatibilitats' },
        { id: 'B.15', codi: 'B.15', bloc: 'B', nom: "Drets i deures dels funcionaris públics locals. Adquisició i pèrdua de la condició de funcionari.", materia: 'disciplinari_incompatibilitats' },
        { id: 'B.16', codi: 'B.16', bloc: 'B', nom: "Règim d´incompatibilitats del personal al servei de les administracions públiques.", materia: 'disciplinari_incompatibilitats' },
        // Bloc C
        { id: 'C.1', codi: 'C.1', bloc: 'C', nom: "Les competències de la Generalitat en matèria de seguretat.", materia: 'seguretat_publica' },
        { id: 'C.2', codi: 'C.2', bloc: 'C', nom: "La coordinació entre administracions i cossos policials que actuen a Catalunya.", materia: 'seguretat_publica' },
        { id: 'C.3', codi: 'C.3', bloc: 'C', nom: "La policia de Catalunya: Mossos d'Esquadra i policies locals.", materia: 'llei_16_1991' },
        { id: 'C.4', codi: 'C.4', bloc: 'C', nom: "La funció policial en matèria de seguretat ciutadana (LO 4/2015).", materia: 'seguretat_ciutadana' },
        { id: 'C.5', codi: 'C.5', bloc: 'C', nom: "La funció policial en la investigació de delictes.", materia: 'codi_penal' },
        { id: 'C.6', codi: 'C.6', bloc: 'C', nom: "La funció policial en seguretat viària i trànsit.", materia: 'transit' },
        { id: 'C.7', codi: 'C.7', bloc: 'C', nom: "Codi deontològic policial.", materia: 'codi_etica' },
        { id: 'C.8', codi: 'C.8', bloc: 'C', nom: "El marc legal de la seguretat a l'Estat: forces i cossos de seguretat (LO 2/1986).", materia: 'forces_cossos' },
        { id: 'C.9', codi: 'C.9', bloc: 'C', nom: "La construcció d'un espai de seguretat, justícia i llibertat: els acords internacionals.", materia: 'seguretat_publica' },
        { id: 'C.10', codi: 'C.10', bloc: 'C', nom: "Competències municipals en matèria de seguretat i protecció civil.", materia: 'seguretat_publica' },
        { id: 'C.11', codi: 'C.11', bloc: 'C', nom: "Règim disciplinari dels funcionaris públics pertanyents a un cos de la Policia Local (Decret 179/2015).", materia: 'disciplinari_incompatibilitats' },
        { id: 'C.12', codi: 'C.12', bloc: 'C', nom: "La denúncia. Concepte i classes. El dret i el deure de denunciar. Efectes. Informes, actes i atestats.", materia: 'atestat_policial' },
        // Bloc D
        { id: 'D.1', codi: 'D.1', bloc: 'D', nom: "El Règim local a Catalunya.", materia: 'regim_local' },
        { id: 'D.2', codi: 'D.2', bloc: 'D', nom: "El municipi.", materia: 'regim_local' },
        { id: 'D.3', codi: 'D.3', bloc: 'D', nom: "Les policies locals a Catalunya. Llei 16/1991.", materia: 'llei_16_1991' },
        { id: 'D.4', codi: 'D.4', bloc: 'D', nom: "Història, territori, societat, estructura i cultura del municipi de Cunit.", materia: 'especific_cunit', especific: true }
      ]
    }
  };

  // 3. Funció de detecció de matèria per a cada pregunta
  function detectarMateriaPregunta(q) {
    if (!q) return 'altres';
    const s = (q.seccio || q.tema || '').toLowerCase();
    const txt = `${s} ${q.categoria || ''} ${q.pregunta || ''}`.toLowerCase();
    const qMun = (q.municipi || '').toLowerCase();

    // Locals específics
    if (txt.includes('constantí') || txt.includes('constanti')) {
      if (txt.includes('ordenan') || txt.includes('convivència') || txt.includes('convivencia')) return 'especific_constanti_ordenances';
      if (txt.includes('coneixement') || txt.includes('carrer') || txt.includes('municipi de constantí')) return 'especific_constanti_coneixement';
    }
    if (txt.includes('cubelles') || qMun === 'cubelles') {
      if (txt.includes('ordenan') || txt.includes('història') || txt.includes('festa') || txt.includes('institucio') || txt.includes('geografia')) {
        return 'especific_cubelles';
      }
    }
    if (txt.includes('cunit') || qMun === 'cunit') {
      if (txt.includes('història') || txt.includes('territori') || txt.includes('societat') || txt.includes('cultura')) {
        return 'especific_cunit';
      }
    }

    // Seccions oficials del Banc de Mossos d'Esquadra (preguntes reals d'oposició)
    if (s.includes('reals b1') || s.includes('estatut d’autonomia') || s.includes("estatut d'autonomia")) return 'estatut';
    if (s.includes('reals b2') || s.includes('institucions polítiques de catalunya')) return 'estatut';
    if (s.includes('reals b3') || s.includes('ordenament jurídic')) return 'procediment_administratiu';
    if (s.includes('reals b4') || s.includes('drets humans')) return 'constitucio';
    if (s.includes('reals b5') || s.includes('institucions polítiques de l’estat') || s.includes("institucions polítiques de l'estat")) return 'constitucio';
    if (s.includes('reals b6') || s.includes('òrgans jurisdiccionals')) return 'constitucio';
    if (s.includes('reals b7') || s.includes('organització territorial de l’estat') || s.includes("organització territorial de l'estat")) return 'regim_local';
    if (s.includes('reals b8') || s.includes('unió europea')) return 'unio_europea';
    if (s.includes('reals c1') || s.includes('competències de la generalitat en matèria de seguretat')) return 'seguretat_publica';
    if (s.includes('reals c2') || s.includes('departament d’interior') || s.includes("departament d'interior")) return 'seguretat_publica';
    if (s.includes('reals c3') || s.includes('coordinació policial')) return 'seguretat_publica';
    if (s.includes('reals c4') || s.includes('marc legal de la seguretat')) {
      if (txt.includes('2/1986') || txt.includes('forces i cossos')) return 'forces_cossos';
      return 'seguretat_publica';
    }
    if (s.includes('reals c5') || s.includes('codi deontològic')) return 'codi_etica';

    // Seccions A de Cultura General / Àmbit Institucional i Social de Mossos
    if (s.includes('història de catalunya') || s.includes('historia de catalunya') || s.includes('reals a1') || s.includes('reals a2')) return 'historia_catalunya';
    if (s.includes('història de la policia') || s.includes('reals a3')) return 'historia_policia';
    if (s.includes('sociolingüístic') || s.includes('sociolinguístic') || s.includes('reals a4')) return 'sociolinguistica';
    if (s.includes('marc geogràfic') || s.includes('reals a5')) return 'geografia_catalunya';
    if (s.includes('entorn social') || s.includes('reals a6')) return 'entorn_social';
    if (s.includes('tecnologies de la informació') || s.includes('reals a7')) return 'canvi_social';

    // Matèries comunes troncals
    if (txt.includes('constituci') || txt.includes('tribunal constitucional') || txt.includes('defensor del poble') || txt.includes('drets i deures fonamentals')) {
      return 'constitucio';
    }
    if (txt.includes('estatut') || txt.includes('generalitat: competències') || txt.includes('institucions polítiques de catalunya')) {
      return 'estatut';
    }
    if (txt.includes('16/1991') || txt.includes('policies locals de catalunya')) {
      return 'llei_16_1991';
    }
    if (txt.includes('4/2015') || txt.includes('seguretat ciutadana')) {
      return 'seguretat_ciutadana';
    }
    if (txt.includes('2/1986') || txt.includes('forces i cossos de seguretat')) {
      return 'forces_cossos';
    }
    if (txt.includes('codi penal') || txt.includes('delictes contra') || txt.includes('homicidi') || txt.includes('lesions') || txt.includes('delictes lleus') || txt.includes('jurisdicció penal')) {
      return 'codi_penal';
    }
    if (txt.includes('4/2003') || txt.includes('seguretat pública de catalunya') || txt.includes('juntes locals de seguretat') || txt.includes('meses de coordinació')) {
      return 'seguretat_publica';
    }
    if (txt.includes('ètica') || txt.includes('etica') || txt.includes('deontològic') || txt.includes('deontologic')) {
      return 'codi_etica';
    }
    if (txt.includes('accident') || txt.includes('alcoholèmi') || txt.includes('alcoholemia')) {
      return 'accidents_transit';
    }
    if (txt.includes('circulació') || txt.includes('circulacio') || txt.includes('conductors') || txt.includes('trànsit') || txt.includes('transit') || txt.includes('seguretat viària') || txt.includes('seguretat viaria')) {
      return 'transit';
    }
    if (txt.includes('detenci') || txt.includes('detingut') || txt.includes('habeas corpus') || txt.includes('registre de domicili')) {
      return 'detencions';
    }
    if (txt.includes('atestat') || txt.includes('denúncia') || txt.includes('denuncia')) {
      return 'atestat_policial';
    }
    if (txt.includes('179/2015') || txt.includes('disciplinari') || txt.includes('incompatibilitats') || txt.includes('funció pública') || txt.includes('funcio publica') || txt.includes('empleats públics')) {
      return 'disciplinari_incompatibilitats';
    }
    if (txt.includes('procediment administratiu') || txt.includes('acte administratiu') || txt.includes('administració pública') || txt.includes('administracio publica') || txt.includes('recursos administratius') || txt.includes('39/2015') || txt.includes('pressupost municipal') || txt.includes('ordenament jurídic')) {
      return 'procediment_administratiu';
    }
    if (txt.includes('organització territorial') || txt.includes('comunitats autònomes') || txt.includes('bases del règim local') || txt.includes('el municipi') || txt.includes('7/1985') || txt.includes('ordenances i els bans')) {
      return 'regim_local';
    }
    if (txt.includes('protecció de dades') || txt.includes('transparència') || txt.includes('transparencia')) {
      return 'transparencia_dades';
    }
    if (txt.includes('unió europea') || txt.includes('unio europea')) {
      return 'unio_europea';
    }
    if (txt.includes('medi ambient') || txt.includes('delicte ecològic') || txt.includes('ecològic')) {
      return 'medi_ambient';
    }
    if (txt.includes('sociolingüístic') || txt.includes('sociolinguístic')) {
      return 'sociolinguistica';
    }
    if (txt.includes('història de catalunya') || txt.includes('historia de catalunya')) {
      return 'historia_catalunya';
    }
    if (txt.includes('geografia de catalunya')) {
      return 'geografia_catalunya';
    }
    if (txt.includes('canvi social')) {
      return 'canvi_social';
    }
    if (txt.includes('estructura econòmica') || txt.includes('entorn')) {
      return 'entorn_social';
    }
    if (q.ambit === 'Cultura General') return 'cultura_general';
    return 'altres';
  }

  // 4. Estat de municipis (persistència en localStorage)
  const MUNICIPIS_PL_KEY = 'agentmedina_municipis_pl_v1';
  const MUNICIPIS_PL_DEFECTE = ['Constantí', 'Cubelles', 'Cunit'];
  const MUNICIPI_ACTIU_KEY = 'agentmedina_pl_municipi_actiu_v1';

  function carregarMunicipisPL() {
    try {
      const raw = localStorage.getItem(MUNICIPIS_PL_KEY);
      if (raw !== null) {
        const llista = JSON.parse(raw);
        if (Array.isArray(llista) && llista.length > 0) {
          // Assegurar que els 3 oficials estan presents
          ['Constantí', 'Cubelles', 'Cunit'].forEach(m => {
            if (!llista.some(item => item.toLowerCase() === m.toLowerCase())) {
              llista.push(m);
            }
          });
          return llista;
        }
      }
      guardarMunicipisPL(MUNICIPIS_PL_DEFECTE);
      return [...MUNICIPIS_PL_DEFECTE];
    } catch (e) {
      console.error('Error llegint municipis PL:', e);
      return [...MUNICIPIS_PL_DEFECTE];
    }
  }

  function guardarMunicipisPL(llista) {
    try {
      localStorage.setItem(MUNICIPIS_PL_KEY, JSON.stringify(llista || []));
    } catch (e) {
      console.error('Error guardant municipis PL:', e);
    }
  }

  function afegirMunicipiPL(nom) {
    const llista = carregarMunicipisPL();
    const net = String(nom || '').trim();
    if (!net) return false;
    if (llista.some(m => m.trim().toLowerCase() === net.toLowerCase())) return false;
    llista.push(net);
    guardarMunicipisPL(llista);
    return true;
  }

  function eliminarMunicipiPL(nom) {
    const target = String(nom || '').trim().toLowerCase();
    const llista = carregarMunicipisPL().filter(m => String(m).trim().toLowerCase() !== target);
    guardarMunicipisPL(llista);
    return true;
  }

  function obtenirMunicipiActiuPL() {
    try {
      const m = localStorage.getItem(MUNICIPI_ACTIU_KEY);
      return m && m.trim() ? m.trim() : 'Constantí';
    } catch {
      return 'Constantí';
    }
  }

  function establirMunicipiActiuPL(nom) {
    try {
      localStorage.setItem(MUNICIPI_ACTIU_KEY, nom);
    } catch (e) {
      console.error('Error guardant municipi actiu:', e);
    }
  }

  // 5. Obtenir llista ordenada de temes per a un municipi
  function obtenirTemariPLPerMunicipi(municipi) {
    const mun = (municipi || obtenirMunicipiActiuPL()).trim();
    if (TEMARIS_MUNICIPALS[mun]) {
      return TEMARIS_MUNICIPALS[mun].temes;
    }
    // Per a municipis afegits dinàmicament per l'usuari, es fa servir el model base de 40 temes
    // personalitzant els dos temes específics locals
    const base = TEMARIS_MUNICIPALS['Constantí'].temes;
    return base.map(t => {
      if (t.id === '35') {
        return {
          id: '35',
          codi: 'T35',
          nom: `Ordenança Municipal de Convivència Ciutadana a la Via Pública (${mun}).`,
          materia: `especific_${mun.toLowerCase()}`,
          especific: true
        };
      }
      if (t.id === '38') {
        return {
          id: '38',
          codi: 'T38',
          nom: `Coneixement del municipi de ${mun} (història, geografia, carrerer i equipaments).`,
          materia: `especific_${mun.toLowerCase()}`,
          especific: true
        };
      }
      return { ...t };
    });
  }

  // 6. Obtenir preguntes associades a un tema concret d'un municipi
  function obtenirPreguntesPerTemaPL(municipi, temaItem, banc) {
    if (!temaItem) return [];
    const pool = Array.isArray(banc) ? banc : (window.bancoPoliciaLocal || []);
    const mun = (municipi || obtenirMunicipiActiuPL()).trim();
    const munLow = mun.toLowerCase();
    const temaId = String(temaItem.id || temaItem.num || '').trim();

    return pool.filter(q => {
      if (!q) return false;
      const qTxt = `${q.seccio || ''} ${q.tema || ''} ${q.categoria || ''}`.toLowerCase();
      const qMun = (q.municipi || '').trim().toLowerCase();

      // Si la pregunta és específica d'un altre municipi diferent, s'exclou
      if (qMun && qMun !== 'comú' && qMun !== 'comu' && qMun !== 'tots' && qMun !== munLow) {
        return false;
      }

      // 1. Si és un tema específic local (ordenances, carrerer, història local)
      if (temaItem.especific) {
        if (qMun === munLow) return true;
        if (munLow === 'constantí' || munLow === 'constanti') {
          if (temaId === '35' && qTxt.includes('ordenança municipal de convivència ciutadana a la via pública (constantí)')) return true;
          if (temaId === '38' && (qTxt.includes('constantí') || qTxt.includes('constanti'))) return true;
        }
        if (munLow === 'cubelles' && qTxt.includes('cubelles')) return true;
        if (munLow === 'cunit' && qTxt.includes('cunit')) return true;
        return false;
      }

      // 2. Si la pregunta té associat exactament aquest tema pel municipi actiu
      // (ex: q.tema === 'Tema 1' o q.seccio.includes('Tema 1') o coincideix el títol del tema)
      if (munLow === 'constantí' || munLow === 'constanti') {
        const m = qTxt.match(/tema\s*(\d+)/i);
        if (m && String(m[1]) === temaId) {
          return true;
        }
      }

      // 3. Associació per matèria comuna (Dret Constitucional, Penal, Trànsit, Llei 16/1991...)
      if (temaItem.materia) {
        const mat = detectarMateriaPregunta(q);
        if (mat === temaItem.materia) {
          return true;
        }
      }

      return false;
    });
  }

  // 7. Estat i gestió de la integració amb preguntes de Mossos d'Esquadra
  const INTEGRAR_MOSSOS_KEY = 'agentmedina_pl_integrar_mossos_v1';

  function esModeIntegracioMossosActiu() {
    try {
      const val = localStorage.getItem(INTEGRAR_MOSSOS_KEY);
      return val === null ? true : (val === 'true'); // Activat per defecte
    } catch {
      return true;
    }
  }

  function establirModeIntegracioMossos(actiu) {
    try {
      localStorage.setItem(INTEGRAR_MOSSOS_KEY, actiu ? 'true' : 'false');
    } catch (e) {
      console.error('Error desant preferència de Mossos:', e);
    }
  }

  // Obtenir preguntes de Mossos d'Esquadra compatibles per matèria
  function obtenirPreguntesMossosPerMateria(materiaId) {
    if (!materiaId) return [];
    const pool = window.bancoPreguntes || [];
    if (!Array.isArray(pool) || pool.length === 0) return [];

    return pool.filter(q => {
      if (!q) return false;
      return detectarMateriaPregunta(q) === materiaId;
    }).map(q => ({
      ...q,
      _idOriginal: q.id,
      id: `mossos_${q.id}`,
      fontBanc: 'mossos',
      esDeMossos: true,
      etiquetaOrigen: '🦁 Mossos d\'Esquadra (Tema comú)'
    }));
  }

  // Obtenir preguntes de Mossos compatibles per a un tema concret d'un municipi
  function obtenirPreguntesMossosPerTemaPL(municipi, temaItem) {
    if (!temaItem || temaItem.especific || !temaItem.materia) return [];
    return obtenirPreguntesMossosPerMateria(temaItem.materia);
  }

  // Obtenir totes les preguntes d'un tema (PL + Mossos compatibles)
  function obtenirPreguntesTotalsTemaPL(municipi, temaItem, bancPL, forcarIncloureMossos) {
    const pl = obtenirPreguntesPerTemaPL(municipi, temaItem, bancPL);
    const incloure = (typeof forcarIncloureMossos === 'boolean') ? forcarIncloureMossos : esModeIntegracioMossosActiu();
    if (!incloure) return pl;

    const mossos = obtenirPreguntesMossosPerTemaPL(municipi, temaItem);
    if (!mossos.length) return pl;

    const textosExistents = new Set(pl.map(q => (q.pregunta || '').trim().toLowerCase()));
    const unicsMossos = mossos.filter(q => !textosExistents.has((q.pregunta || '').trim().toLowerCase()));

    return [...pl, ...unicsMossos];
  }

  // 8. Obtenir totes les preguntes aptes d'un municipi (per a test barrejat)
  function obtenirTotesPreguntesMunicipiPL(municipi, banc, forcarIncloureMossos) {
    const pool = Array.isArray(banc) ? banc : (window.bancoPoliciaLocal || []);
    const mun = (municipi || obtenirMunicipiActiuPL()).trim();
    const munLow = mun.toLowerCase();

    // 1. Preguntes base del banc de Policia Local
    const pl = pool.filter(q => {
      if (!q) return false;
      const qMun = (q.municipi || '').trim().toLowerCase();
      // Si la pregunta pertany explícitament a un altre municipi, no s'inclou
      if (qMun && qMun !== 'comú' && qMun !== 'comu' && qMun !== 'tots' && qMun !== munLow) {
        return false;
      }
      // Si la pregunta és específica local d'un altre municipi pel text
      const qTxt = `${q.seccio || ''} ${q.tema || ''} ${q.categoria || ''} ${q.pregunta || ''}`.toLowerCase();
      if (munLow !== 'constantí' && munLow !== 'constanti' && qTxt.includes('constantí')) return false;
      if (munLow !== 'cubelles' && qTxt.includes('cubelles')) return false;
      if (munLow !== 'cunit' && qTxt.includes('cunit')) return false;

      // No incloure Cultura General pura al test de temari teòric si té àmbit diferent
      if (q.ambit === 'Cultura General') return false;

      return true;
    });

    const incloure = (typeof forcarIncloureMossos === 'boolean') ? forcarIncloureMossos : esModeIntegracioMossosActiu();
    if (!incloure) return pl;

    // 2. Afegir preguntes de Mossos dels temes del temari oficial d'aquest municipi
    const temari = TEMARIS_MUNICIPALS[mun] || TEMARIS_MUNICIPALS['Constantí'];
    const materiasMunicipi = new Set();
    (temari?.temes || []).forEach(t => {
      if (t.materia && !t.especific) materiasMunicipi.add(t.materia);
    });

    const poolMossos = window.bancoPreguntes || [];
    const mossosAptes = [];
    const textosExistents = new Set(pl.map(q => (q.pregunta || '').trim().toLowerCase()));

    poolMossos.forEach(q => {
      if (!q) return;
      const mat = detectarMateriaPregunta(q);
      if (materiasMunicipi.has(mat)) {
        const textKey = (q.pregunta || '').trim().toLowerCase();
        if (!textosExistents.has(textKey)) {
          textosExistents.add(textKey);
          mossosAptes.push({
            ...q,
            _idOriginal: q.id,
            id: `mossos_${q.id}`,
            fontBanc: 'mossos',
            esDeMossos: true,
            etiquetaOrigen: '🦁 Mossos d\'Esquadra (Tema comú)'
          });
        }
      }
    });

    return [...pl, ...mossosAptes];
  }

  // 9. Obtenir preguntes d'una matèria compartida (amb opció d'incloure Mossos)
  function obtenirPreguntesMateriaCompartida(materiaId, banc, incloureMossos) {
    const pool = Array.isArray(banc) ? banc : (window.bancoPoliciaLocal || []);
    const pl = pool.filter(q => {
      if (!q) return false;
      return detectarMateriaPregunta(q) === materiaId;
    });

    const incloure = (typeof incloureMossos === 'boolean') ? incloureMossos : esModeIntegracioMossosActiu();
    if (!incloure) return pl;

    const mossos = obtenirPreguntesMossosPerMateria(materiaId);
    const textosExistents = new Set(pl.map(q => (q.pregunta || '').trim().toLowerCase()));
    const unicsMossos = mossos.filter(q => !textosExistents.has((q.pregunta || '').trim().toLowerCase()));

    return [...pl, ...unicsMossos];
  }

  // 10. Copiar/importar preguntes de Mossos al banc de Policia Local del municipi seleccionat
  async function importarPreguntesMossosAMunicipi(materiaOpcional, municipiDesti) {
    const mun = (municipiDesti || obtenirMunicipiActiuPL()).trim();
    const mossos = window.bancoPreguntes || [];
    if (!mossos.length) throw new Error("No s'han trobat preguntes al banc de Mossos.");

    const poolPL = window.bancoPoliciaLocal || [];
    const textosPL = new Set(poolPL.map(q => (q.pregunta || '').trim().toLowerCase()));

    let candidates = mossos;
    if (materiaOpcional) {
      candidates = candidates.filter(q => detectarMateriaPregunta(q) === materiaOpcional);
    } else {
      const temari = TEMARIS_MUNICIPALS[mun];
      const materias = new Set((temari?.temes || []).filter(t => t.materia && !t.especific).map(t => t.materia));
      candidates = candidates.filter(q => materias.has(detectarMateriaPregunta(q)));
    }

    const novesPreguntes = [];
    let maxId = poolPL.reduce((acc, q) => Math.max(acc, Number(q.id) || 0), 2000);

    candidates.forEach(q => {
      const textKey = (q.pregunta || '').trim().toLowerCase();
      if (!textosPL.has(textKey)) {
        textosPL.add(textKey);
        maxId++;
        novesPreguntes.push({
          id: maxId,
          ambit: 'Temari Comú',
          seccio: q.seccio || q.tema || 'Temari compartit',
          tema: q.seccio || q.tema || 'Temari compartit',
          municipi: mun,
          pregunta: q.pregunta,
          opcions: Array.isArray(q.opcions) ? [...q.opcions] : q.opcions,
          resposta: q.resposta,
          explicacio: (q.explicacio ? `${q.explicacio} · ` : '') + `(Pregunta oficial importada del banc de Mossos d'Esquadra per a ${mun})`
        });
      }
    });

    if (!novesPreguntes.length) {
      return { totalImportades: 0, missatge: "Totes les preguntes compatibles ja estan incorporades a aquest municipi." };
    }

    // Afegir a memòria
    poolPL.push(...novesPreguntes);

    // Intentar desar al servidor si hi ha l'endpoint actiu
    try {
      await fetch('/api/custom-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poolPL)
      });
    } catch (e) {
      console.warn('Nota: Desat en memòria/local:', e);
    }

    return { totalImportades: novesPreguntes.length, novesPreguntes };
  }

  // Exportar al scope global de l'aplicació
  window.MATERIES_COMPARTIDES = MATERIES_COMPARTIDES;
  window.TEMARIS_MUNICIPALS = TEMARIS_MUNICIPALS;
  window.detectarMateriaPregunta = detectarMateriaPregunta;
  window.carregarMunicipisPL = carregarMunicipisPL;
  window.guardarMunicipisPL = guardarMunicipisPL;
  window.afegirMunicipiPL = afegirMunicipiPL;
  window.eliminarMunicipiPL = eliminarMunicipiPL;
  window.obtenirMunicipiActiuPL = obtenirMunicipiActiuPL;
  window.establirMunicipiActiuPL = establirMunicipiActiuPL;
  window.obtenirTemariPLPerMunicipi = obtenirTemariPLPerMunicipi;
  window.obtenirPreguntesPerTemaPL = obtenirPreguntesPerTemaPL;
  window.obtenirTotesPreguntesMunicipiPL = obtenirTotesPreguntesMunicipiPL;
  window.obtenirPreguntesMateriaCompartida = obtenirPreguntesMateriaCompartida;
  window.esModeIntegracioMossosActiu = esModeIntegracioMossosActiu;
  window.establirModeIntegracioMossos = establirModeIntegracioMossos;
  window.obtenirPreguntesMossosPerMateria = obtenirPreguntesMossosPerMateria;
  window.obtenirPreguntesMossosPerTemaPL = obtenirPreguntesMossosPerTemaPL;
  window.obtenirPreguntesTotalsTemaPL = obtenirPreguntesTotalsTemaPL;
  window.importarPreguntesMossosAMunicipi = importarPreguntesMossosAMunicipi;

})();
