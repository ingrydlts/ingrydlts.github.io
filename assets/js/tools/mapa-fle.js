// Por Dentro — ferramenta embutida no artigo "selo-qualite-fle-mapa-cursos-de-frances":
// mapa + busca + lista dos 110 centros credenciados com o selo Qualité FLE.
//
// Fica num módulo à parte (em vez de HTML solto no corpo do artigo) porque o corpo
// do artigo é editado como markdown puro pelo /admin — o parser (assets/js/markdown.js)
// escapa qualquer HTML de propósito, pra manter o campo "Corpo do artigo" seguro pra
// edição de texto. O marcador "[[MAPA-FLE]]" no corpo vira um <div id="tool-mapa-fle">
// (ver /artigos/post/index.html) e este módulo só é carregado (e só monta) quando
// esse mount point existe na página — nenhum outro artigo paga o custo dos 110 registros.
//
// Dados: Ministério da Educação Nacional francês, via data.gouv.fr (fev/2025).

const PINS = [{"id":0,"name":"ACCENTS - Centre de français de l'université Savoie Mont Blanc","city":"Chambéry","region":"Auvergne-Rhône-Alpes","phone":"+33(0)479758414","site":"https://www.univ-smb.fr/accents/","postal":"73011","lat":45.6683,"lon":6.40433,"x":455.1,"y":336.2},{"id":1,"name":"Centre audiovisuel de Royan pour l'étude des langues (CAREL)","city":"Royan","region":"Nouvelle-Aquitaine","phone":"+33(0)546395000","site":"https://www.carel.org","postal":"17200","lat":46.18681,"lon":-1.15264,"x":156.1,"y":306.3},{"id":2,"name":"Centre international d’études françaises (CIEF)","city":"Lyon","region":"Auvergne-Rhône-Alpes","phone":"+33(0)478697436","site":"http://cief.univ-lyon2.fr/","postal":"69365","lat":45.77006,"lon":4.82852,"x":392.8,"y":330.3},{"id":3,"name":"Centre universitaire d’études françaises (CUEF) - Université de Perpignan Via Domitia (UPVD)","city":"Perpignan","region":"Occitanie","phone":"+33(0)468662010","site":"https://www.cuef.fr","postal":"66860","lat":42.69644,"lon":2.89898,"x":316.4,"y":507.7},{"id":4,"name":"Cours de civilisation française de la Sorbonne","city":"Paris","region":"Île-de-France","phone":"+33(0)144107700","site":"https://www.ccfs-sorbonne.fr/","postal":"75007","lat":48.85617,"lon":2.31215,"x":299.2,"y":152.3},{"id":5,"name":"DéFLE Université de Lorraine (Metz)","city":"Metz","region":"Grand Est","phone":"+33(0)372747705","site":"http://defle.univ-lorraine.fr/fr","postal":"57012","lat":49.36472,"lon":6.04783,"x":441.0,"y":122.9},{"id":6,"name":"Département de l’enseignement  du français à l’international (DEFI) -  Centre universitaire de FLE/Lille 3","city":"Villeneuve d'Ascq","region":"Hauts-de-France","phone":"+33(0)320416387","site":"https://clil.univ-lille.fr/defi/","postal":"59653","lat":50.57252,"lon":2.93309,"x":317.8,"y":53.2},{"id":7,"name":"Espace Langues - Université Sorbonne Paris Nord","city":"Villetaneuse","region":"Île-de-France","phone":"+33(0)149403162","site":"https://www.univ-paris13.fr/espace-langues/","postal":"93430","lat":48.95755,"lon":2.34552,"x":294.5,"y":146.4},{"id":8,"name":"Eurocentres Paris - Centres langues et civilisations - Eurocentres France","city":"Paris","region":"Île-de-France","phone":"+33(0)140467200","site":"https://www.eurocentres.com","postal":"75006","lat":48.84912,"lon":2.33288,"x":300.0,"y":152.7},{"id":9,"name":"FRATE Formation Conseil","city":"Besançon","region":"Bourgogne-Franche-Comté","phone":"+33(0)381822175","site":"https://www.frateformation.net","postal":"25000","lat":47.25518,"lon":6.01931,"x":445.9,"y":244.6},{"id":10,"name":"IESIG FLE","city":"Paris","region":"Île-de-France","phone":"+33(0)153801032","site":"https://www.iesig-fle.com/","postal":"75013","lat":48.82842,"lon":2.36225,"x":295.2,"y":153.9},{"id":11,"name":"ILE International - Expertise Langues","city":"Paris","region":"Île-de-France","phone":"+33(0)143445850","site":"https://www.ile-international.com/","postal":"75012","lat":48.83496,"lon":2.42139,"x":297.5,"y":153.5},{"id":12,"name":"inlingua La Rochelle","city":"La Rochelle","region":"Nouvelle-Aquitaine","phone":"+33(0)540000200","site":"https://www.inlingua-larochelle.com","postal":"17000","lat":46.16242,"lon":-1.17348,"x":161.3,"y":307.7},{"id":13,"name":"Institut de langue et de culture françaises Lyon (ILCF Lyon) - UCLy","city":"Lyon","region":"Auvergne-Rhône-Alpes","phone":"+33(0)472325053","site":"https://www.ilcf.net","postal":"69286","lat":45.82043,"lon":4.89884,"x":395.6,"y":327.4},{"id":14,"name":"Institut Francophonie","city":"Nantes","region":"Pays de la Loire","phone":"+33(0)253782644","site":"https://www.francophonie-nantes.fr/","postal":"44000","lat":47.23205,"lon":-1.5482,"x":146.5,"y":246.0},{"id":15,"name":"Institut linguistique Adenet (ILA)","city":"Montpellier","region":"Occitanie","phone":"+33(0)467606783","site":"http://www.ila-france.com","postal":"34000","lat":43.61335,"lon":3.86926,"x":360.8,"y":454.8},{"id":16,"name":"Lyon Bleu international","city":"Lyon","region":"Auvergne-Rhône-Alpes","phone":"+33(0)437480026","site":"https://www.lyon-bleu.fr","postal":"69006","lat":45.96473,"lon":4.32841,"x":373.0,"y":319.1},{"id":17,"name":"RECIFE","city":"Le Havre","region":"Normandie","phone":"+33(0)235246868","site":"https://www.recife-lh.com","postal":"76600","lat":49.7321,"lon":0.34238,"x":215.3,"y":101.7},{"id":18,"name":"SOFI 64","city":"Anglet","region":"Nouvelle-Aquitaine","phone":"+33(0)559457923","site":"https://www.sofi64.com/","postal":"64600","lat":43.49066,"lon":-1.5151,"x":141.8,"y":461.8},{"id":19,"name":"Tours Langues","city":"Tours","region":"Centre-Val de Loire","phone":"+33(0)247660100","site":"https://www.langues.com","postal":"37000","lat":47.39841,"lon":0.6961,"x":235.3,"y":236.4},{"id":20,"name":"Accent Français","city":"Montpellier","region":"Occitanie","phone":"+33(0)467581268","site":"https://www.accentfrancais.com","postal":"34000","lat":43.61335,"lon":3.86926,"x":351.8,"y":459.9},{"id":21,"name":"Alliance Française Nice Côte d'Azur","city":"Nice","region":"Provence-Alpes-Côte d'Azur","phone":"+33(0)493626766","site":"http://af-nice.fr/fr","postal":"06000","lat":43.71236,"lon":7.23794,"x":494.1,"y":449.0},{"id":22,"name":"Centre de français langue étrangère (CFLE) - Université de Poitiers","city":"Poitiers","region":"Nouvelle-Aquitaine","phone":"+33(0)549453294","site":"https://cfle.univ-poitiers.fr/","postal":"86073","lat":46.6945,"lon":0.02674,"x":202.8,"y":277.0},{"id":23,"name":"Centre de français langue étrangère du CIHEAM-Montpellier (CFLE-CIHEAM-Montpellier)","city":"Montpellier","region":"Occitanie","phone":"+33(0)467046002","site":"https://www.fle-montpellier.com","postal":"34093","lat":43.66884,"lon":3.22152,"x":329.2,"y":451.6},{"id":24,"name":"Centre de Langues de l'UBS (Clubs) - Université Bretagne Sud","city":"Lorient","region":"Bretagne","phone":"+33(0)297872919","site":"https://www.univ-ubs.fr/clubs","postal":"56321","lat":47.75071,"lon":-3.37892,"x":68.0,"y":216.0},{"id":25,"name":"Centre international d'Antibes (CIA)","city":"Antibes","region":"Provence-Alpes-Côte d'Azur","phone":"+33(0)492907170","site":"https://www.cia-france.com/","postal":"06600","lat":43.58776,"lon":7.10522,"x":482.9,"y":456.2},{"id":26,"name":"Centre international d’études de langues (CIEL de STRASBOURG) - Pôle formation CCI","city":"Strasbourg","region":"Grand Est","phone":"+33(0)388430822","site":"https://www.ciel-strasbourg.org","postal":"67021","lat":48.41493,"lon":7.39834,"x":494.5,"y":177.7},{"id":27,"name":"Centre international rennais d’études de français pour étrangers (CIREFE) - Université Rennes 2","city":"Rennes","region":"Bretagne","phone":"+33(0)223225820","site":"https://sites-formations.univ-rennes2.fr/cirefe/","postal":"35043","lat":48.11168,"lon":-1.68187,"x":141.2,"y":195.2},{"id":28,"name":"Centre linguistique pour étrangers (CLÉ)","city":"Tours","region":"Centre-Val de Loire","phone":"+33(0)247640619","site":"https://www.cle.fr","postal":"37000","lat":47.39841,"lon":0.6961,"x":223.3,"y":236.4},{"id":29,"name":"Centre universitaire d’enseignement du français aux étudiants étrangers (CUEFEE) - Université de Tours François-Rabelais","city":"Tours","region":"Centre-Val de Loire","phone":"NULL","site":"http://international.univ-tours.fr/profils/apprendre-le-francais-a-l-universite-de-tours-267688.kjsp?RH=1324203976017","postal":"37041","lat":47.6309,"lon":0.55266,"x":223.6,"y":223.0},{"id":30,"name":"Collège et Lycée International Saint-Denis","city":"Loches","region":"Centre-Val de Loire","phone":"+33(0)247591733","site":"https://www.saint-denis.net","postal":"37601","lat":47.12042,"lon":0.97402,"x":240.3,"y":252.4},{"id":31,"name":"Confluence Formation Strasbourg","city":"Strasbourg","region":"Grand Est","phone":"+33(0)388223576","site":"https://www.confluence-alsace.com","postal":"67000","lat":48.57126,"lon":7.76776,"x":515.1,"y":168.7},{"id":32,"name":"École des Ponts ParisTech","city":"Champs-sur-Marne","region":"Île-de-France","phone":"+33(0)164153504","site":"https://www.enpc.fr/la-section-de-francais","postal":"77455","lat":48.64501,"lon":2.70782,"x":308.9,"y":164.4},{"id":33,"name":"École polytechnique de Palaiseau - Département des langues et cultures","city":"Palaiseau","region":"Île-de-France","phone":"+33(0)169333370","site":"https://portail.polytechnique.edu/dlc/langues/francais","postal":"91128","lat":48.7148,"lon":2.22867,"x":289.9,"y":160.4},{"id":34,"name":"Greta Aquitaine - DPFI - Cours de FLE","city":"Lormont","region":"Nouvelle-Aquitaine","phone":"+33(0)557776000","site":"https://greta-cfa-aquitaine.fr/","postal":"33305","lat":44.47041,"lon":-0.28082,"x":190.6,"y":405.3},{"id":35,"name":"Institut de français langue étrangère (campus adventiste)","city":"Collonges-sous-Salève","region":"Auvergne-Rhône-Alpes","phone":"+33(0)450876812","site":"https://www.campusadventiste.edu","postal":"74160","lat":45.85022,"lon":6.40093,"x":455.0,"y":325.7},{"id":36,"name":"Institut de langue et de culture françaises (ILCF) -  Institut catholique de Paris (ICP)","city":"Paris","region":"Île-de-France","phone":"+33(0)144395268","site":"https://ilcf.icp.fr/","postal":"75270","lat":48.86346,"lon":2.40116,"x":296.7,"y":151.8},{"id":37,"name":"Institut français des Alpes (IFALPES)","city":"Annecy","region":"Auvergne-Rhône-Alpes","phone":"+33(0)450453837","site":"https://www.ifalpes.com","postal":"74000","lat":45.90164,"lon":6.1181,"x":449.8,"y":322.7},{"id":38,"name":"Institut STRALANG - Strasbourg","city":"Strasbourg","region":"Grand Est","phone":"NULL","site":"https://www.stralang.com","postal":"67000","lat":48.57126,"lon":7.76776,"x":506.1,"y":173.9},{"id":39,"name":"Institut universitaire d'Enseignement du Français langue Etrangère (IEFE) - Université Paul-Valéry Montpellier 3","city":"Montpellier","region":"Occitanie","phone":"+33(0)467142101","site":"http://iefe.univ-montp3.fr","postal":"34199","lat":43.46329,"lon":3.41599,"x":336.9,"y":463.4},{"id":40,"name":"Newdeal Institut de Français","city":"Bordeaux","region":"Nouvelle-Aquitaine","phone":"+33(0)953031620","site":"https://francais.newdealinstitut.com/","postal":"33100","lat":45.12826,"lon":-0.61731,"x":177.3,"y":367.3},{"id":41,"name":"QS'Emploi","city":"Saint-Martin-de-Crau","region":"Provence-Alpes-Côte d'Azur","phone":"+33(0)490913719","site":"https://www.qsemploi.fr/","postal":"13310","lat":43.61203,"lon":4.85637,"x":393.9,"y":454.8},{"id":42,"name":"Sciences Po, Campus de Reims – section FLE","city":"Reims","region":"Grand Est","phone":"+33(0)326059460","site":"http://www.sciencespo.fr/campus-de-reims/fr","postal":"51100","lat":48.90907,"lon":3.77679,"x":351.2,"y":149.2},{"id":43,"name":"Université d'Artois","city":"Arras","region":"Hauts-de-France","phone":"+33(0)321603720","site":"http://lettres.univ-artois.fr/diplome-universitaire/francais-langue-etrangere-pour-la-preparation-aux-etudes-superieures","postal":"62030","lat":50.13723,"lon":2.39718,"x":296.6,"y":78.3},{"id":44,"name":"Université de Technologie de Compiègne (UTC)","city":"Compiègne","region":"Hauts-de-France","phone":"+33(0)344234423","site":"https://www.utc.fr/international.html","postal":"60203","lat":49.2322,"lon":2.84909,"x":314.5,"y":130.6},{"id":45,"name":"ABC Formation","city":"Franconville","region":"Île-de-France","phone":"+33(0)134154062","site":"https://abcformation1986.fr/","postal":"95130","lat":48.98831,"lon":2.22419,"x":289.7,"y":144.6},{"id":46,"name":"Absolutely French","city":"Paris","region":"Île-de-France","phone":"+33(0)183739849","site":"https://www.absolutely-french.eu","postal":"75017","lat":48.88733,"lon":2.30678,"x":293.0,"y":150.5},{"id":47,"name":"Alliance Française Bordeaux Nouvelle-Aquitaine (AF Bordeaux)","city":"Bordeaux","region":"Nouvelle-Aquitaine","phone":"+33(0)556793280","site":"https://www.alliance-bordeaux.org","postal":"33000","lat":44.85762,"lon":-0.57338,"x":179.0,"y":383.0},{"id":48,"name":"Alliance Française de Lyon","city":"Lyon","region":"Auvergne-Rhône-Alpes","phone":"+33(0)478952472","site":"https://www.aflyon.org","postal":"69003","lat":45.8641,"lon":4.83063,"x":392.9,"y":324.9},{"id":49,"name":"Alliance Française de Toulouse","city":"Toulouse","region":"Occitanie","phone":"+33(0)534452610","site":"http://www.alliance-toulouse.org/","postal":"31400","lat":43.49275,"lon":1.93356,"x":278.2,"y":461.7},{"id":50,"name":"Alpha.b Institut linguistique","city":"Nice","region":"Provence-Alpes-Côte d'Azur","phone":"+33(0)049316003","site":"https://www.alpha-b.fr","postal":"06000","lat":43.71236,"lon":7.23794,"x":488.1,"y":455.0},{"id":51,"name":"Business and Technical Languages (BTL)","city":"Paris","region":"Île-de-France","phone":"+33(0)142934545","site":"https://www.btl.fr/","postal":"75008","lat":48.87272,"lon":2.31256,"x":293.2,"y":151.3},{"id":52,"name":"CAVILAM - Alliance Française","city":"Vichy","region":"Auvergne-Rhône-Alpes","phone":"+33(0)470308383","site":"https://www.cavilam.com","postal":"03206","lat":46.18983,"lon":2.56128,"x":303.1,"y":306.1},{"id":53,"name":"CEFI - Culture Education Formation Individualisée","city":"Bron","region":"Auvergne-Rhône-Alpes","phone":"+33(0)472374897","site":"http://www.cefi-formation.fr/","postal":"69500","lat":45.73468,"lon":4.91194,"x":396.1,"y":332.4},{"id":54,"name":"Centre international d’étude des langues de Brest (CIEL Bretagne)","city":"Le Relecq-Kerhuon","region":"Bretagne","phone":"+33(0)298304575","site":"https://www.ciel.fr","postal":"29480","lat":48.40322,"lon":-4.40124,"x":27.6,"y":178.4},{"id":55,"name":"École de français - Paris (EF)","city":"Paris","region":"Île-de-France","phone":"+33(0)+33155331355","site":"https://www.ef.com","postal":"75009","lat":48.87717,"lon":2.33746,"x":294.2,"y":151.0},{"id":56,"name":"École de langue française (ELFE) - établissement privé d’enseignement supérieur","city":"Paris","region":"Île-de-France","phone":"+33(0)148787300","site":"https://elfe-paris.com/","postal":"75001","lat":48.86255,"lon":2.33642,"x":294.2,"y":151.9},{"id":57,"name":"Éducation et formation","city":"ROUEN","region":"Normandie","phone":"+33(0)276517676","site":"https://www.educationetformation.fr/","postal":"76000","lat":49.4415,"lon":1.09358,"x":251.0,"y":118.5},{"id":58,"name":"FIL - Français Immersion Loisirs","city":"Saint Laurent de Cerdans","region":"Occitanie","phone":"+33(0)448070164","site":"http://fil-ado.com/en","postal":"66260","lat":42.39697,"lon":2.62161,"x":305.5,"y":524.9},{"id":59,"name":"French for engineers - École d’ingénieurs généraliste (EPF) - École spéciale  des travaux publics du bâtiment et de l’industrie (ESTP)","city":"Cachan","region":"Île-de-France","phone":"+33(0)141130151","site":"https://www.epf.fr/","postal":"94230","lat":48.79166,"lon":2.33208,"x":294.0,"y":156.0},{"id":60,"name":"French in Normandy","city":"Rouen","region":"Normandie","phone":"+33(0)235720863","site":"https://www.frenchinnormandy.com","postal":"76100","lat":49.50454,"lon":1.29162,"x":252.8,"y":114.9},{"id":61,"name":"Inflexyon, French intercultural center  of Lyon","city":"Lyon","region":"Auvergne-Rhône-Alpes","phone":"+33(0)478397702","site":"https://www.inflexyon.com","postal":"69002","lat":46.28015,"lon":4.42409,"x":382.8,"y":300.9},{"id":62,"name":"Institut de Touraine","city":"Tours","region":"Centre-Val de Loire","phone":"+33(0)247057683","site":"https://www.institutdetouraine.com","postal":"37020","lat":47.12877,"lon":1.02312,"x":242.2,"y":251.9},{"id":63,"name":"Langues Plurielles","city":"Paris","region":"Île-de-France","phone":"+33(0)140386775","site":"https://langues-plurielles.fr/","postal":"75018","lat":48.89257,"lon":2.34818,"x":294.6,"y":150.2},{"id":64,"name":"LiL'Langues","city":"Lille","region":"Hauts-de-France","phone":"+33(0)320374266","site":"https://lillangues.com/","postal":"59000","lat":50.63186,"lon":3.04699,"x":322.3,"y":49.8},{"id":65,"name":"Pôle FLE de l’Université Gustave Eiffel","city":"Champs-sur-Marne","region":"Île-de-France","phone":"+33(0)171408164","site":"https://www.univ-gustave-eiffel.fr/","postal":"77454","lat":48.5187,"lon":3.1531,"x":326.5,"y":171.7},{"id":66,"name":"Sciences Po, Campus de Paris","city":"Paris","region":"Île-de-France","phone":"+33(0)145495505","site":"http://www.sciencespo.fr/","postal":"75007","lat":48.85617,"lon":2.31215,"x":290.2,"y":157.5},{"id":67,"name":"Alpadia Lyon","city":"Lyon","region":"Auvergne-Rhône-Alpes","phone":"+33(0)472419806","site":"https://www.alpadia.com","postal":"69002","lat":46.28015,"lon":4.42409,"x":370.8,"y":300.9},{"id":68,"name":"Association Reflets","city":"Cagnes-sur-Mer","region":"Provence-Alpes-Côte d'Azur","phone":"+33(0)493206640","site":"http://reflets.asso.fr/","postal":"06800","lat":43.6722,"lon":7.1524,"x":484.7,"y":451.4},{"id":69,"name":"Azurlingua","city":"Nice","region":"Provence-Alpes-Côte d'Azur","phone":"+33(0)497030700","site":"https://www.azurlingua.com","postal":"06000","lat":43.71236,"lon":7.23794,"x":482.1,"y":449.0},{"id":70,"name":"Centre FLE de l'Université de Picardie Jules Verne (UPJV)","city":"Amiens","region":"Hauts-de-France","phone":"+33(0)364268364","site":"https://fle.u-picardie.fr/","postal":"80080","lat":49.88425,"lon":2.86042,"x":314.9,"y":92.9},{"id":71,"name":"Centre méditerranéen d'études françaises (CMEF)","city":"Cap d'Ail","region":"Provence-Alpes-Côte d'Azur","phone":"+33(0)493782159","site":"https://www.cmef-monaco.fr","postal":"06320","lat":43.72539,"lon":7.4011,"x":494.6,"y":448.3},{"id":72,"name":"Centre universitaire d’études françaises (CUEF) - Université Grenoble Alpes","city":"Grenoble","region":"Auvergne-Rhône-Alpes","phone":"+33(0)476743460","site":"http://cuef.univ-grenoble-alpes.fr/","postal":"38400","lat":45.33699,"lon":5.58741,"x":422.8,"y":355.3},{"id":73,"name":"Châteaux des langues","city":"Forcé","region":"Pays de la Loire","phone":"+33(0)243535563","site":"https://www.chateauxdeslangues.com/","postal":"53260","lat":47.88282,"lon":-0.85473,"x":167.9,"y":208.4},{"id":74,"name":"CLA Université de Franche-Comté","city":"Besançon","region":"Bourgogne-Franche-Comté","phone":"+33(0)381665200","site":"http://cla.univ-fcomte.fr/","postal":"25000","lat":47.25518,"lon":6.01931,"x":433.9,"y":244.6},{"id":75,"name":"CY Cergy Paris Université - Centre de langue française","city":"Cergy-Pontoise","region":"Île-de-France","phone":"+33(0)134252251","site":"https://www.u-cergy.fr/fle","postal":"95011","lat":49.15048,"lon":1.69463,"x":268.8,"y":135.3},{"id":76,"name":"École internationale de français (EF)","city":"Nice","region":"Provence-Alpes-Côte d'Azur","phone":"+33(0)493888485","site":"https://www.ef.com","postal":"06000","lat":43.71236,"lon":7.23794,"x":488.1,"y":443.0},{"id":77,"name":"EPITA - Centre de français langue étrangère","city":"Le Kremlin-Bicêtre","region":"Île-de-France","phone":"+33(0)184071600","site":"https://french.epita.fr/en/","postal":"94270","lat":48.80879,"lon":2.35587,"x":294.9,"y":155.0},{"id":78,"name":"Espaces Formation","city":"Nantes","region":"Pays de la Loire","phone":"+33(0)240949952","site":"http://www.espaces-formation.com/","postal":"44187","lat":47.22525,"lon":-2.06625,"x":120.0,"y":246.4},{"id":79,"name":"Français pour étudiants étrangers (FETE) - Université Paris Nanterre","city":"Nanterre","region":"Île-de-France","phone":"+33(0)140977320","site":"http://francais-langue-etrangere.u-paris10.fr/","postal":"92001","lat":48.89617,"lon":2.20709,"x":289.0,"y":150.0},{"id":80,"name":"French As You Like It","city":"Paris","region":"Île-de-France","phone":"+33(0)185099014","site":"https://www.frenchasyoulikeit.com/","postal":"75004","lat":48.85435,"lon":2.35763,"x":301.0,"y":152.4},{"id":81,"name":"Institut de Français Langue Étrangère (i-FLE) - Nantes Université","city":"Nantes","region":"Pays de la Loire","phone":"+33(0)253487701","site":"https://i-fle.univ-nantes.fr","postal":"44312","lat":47.23205,"lon":-1.5482,"x":134.5,"y":246.0},{"id":82,"name":"Institut International Langues & Affaires","city":"Rambouillet","region":"Île-de-France","phone":"+33(0)610632048","site":"https://www.institut-rambouillet.com","postal":"78120","lat":48.62409,"lon":1.98323,"x":280.2,"y":165.6},{"id":83,"name":"Institut Supérieur de l'Aéronautique et de l'Espace (ISAE-SUPAERO)","city":"Toulouse","region":"Occitanie","phone":"+33(0)561338080","site":"https://www.isae-supaero.fr","postal":"31055","lat":43.46791,"lon":1.77075,"x":271.8,"y":463.1},{"id":84,"name":"Institut universitaire de langue et de culture françaises (IULCF Toulouse)","city":"Toulouse","region":"Occitanie","phone":"+33(0)561368130","site":"https://www.ict-toulouse.fr/institut-universitaire-de-langue-et-de-culture-francaises-iulcf/","postal":"31068","lat":42.8159,"lon":0.52915,"x":222.7,"y":500.8},{"id":85,"name":"Language studies international (LSI) - Centre privé de langues","city":"Paris","region":"Île-de-France","phone":"+33(0)142605370","site":"https://www.lsi-paris.fr","postal":"75004","lat":48.85435,"lon":2.35763,"x":289.0,"y":152.4},{"id":86,"name":"Langue et Communication","city":"Rennes","region":"Bretagne","phone":"+33(0)299381255","site":"https://langueetcom.fr","postal":"35000","lat":48.11168,"lon":-1.68187,"x":129.2,"y":195.2},{"id":87,"name":"Langue Onze Toulouse (LOT)","city":"Toulouse","region":"Occitanie","phone":"+33(0)561625458","site":"https://www.langueonze.com","postal":"31000","lat":43.59604,"lon":1.43209,"x":258.4,"y":455.8},{"id":88,"name":"LSF","city":"Montpellier","region":"Occitanie","phone":"+33(0)467913160","site":"https://www.lsf-france.com","postal":"34000","lat":43.61335,"lon":3.86926,"x":351.8,"y":449.6},{"id":89,"name":"Montpellier SupAgro","city":"Montpellier","region":"Occitanie","phone":"+33(0)499612200","site":"https://www.supagro.fr","postal":"34060","lat":43.79322,"lon":3.62962,"x":345.3,"y":444.4},{"id":90,"name":"Rennes School of Business - Pôle Langues","city":"Rennes","region":"Bretagne","phone":"+33(0)299546363","site":"https://www.rennes-sb.fr/the-experience/campus/way-up-langues-vivantes/","postal":"35065","lat":48.12519,"lon":-1.85822,"x":128.2,"y":194.4},{"id":91,"name":"ACCORD - Institut supérieur privé","city":"Paris","region":"Île-de-France","phone":"+33(0)155335233","site":"https://www.accord-langues.com/","postal":"75015","lat":48.84007,"lon":2.29284,"x":298.4,"y":153.2},{"id":92,"name":"ALIP","city":"Paris","region":"Île-de-France","phone":"+33(0)158010061","site":"https://www.alipfrance.com/en/","postal":"75015","lat":48.84007,"lon":2.29284,"x":286.4,"y":153.2},{"id":93,"name":"Alliance Française de Paris","city":"Paris","region":"Île-de-France","phone":"+33(0)142849000","site":"https://www.alliancefr.org","postal":"75006","lat":48.84912,"lon":2.33288,"x":288.0,"y":152.7},{"id":94,"name":"Alliance Française Rouen-Normandie","city":"Rouen","region":"Normandie","phone":"+33(0)235985599","site":"https://www.afnormandie.org/","postal":"76000","lat":49.4415,"lon":1.09358,"x":239.0,"y":118.5},{"id":95,"name":"Alliance Française Strasbourg-Europe -  École de français langue étrangère","city":"Strasbourg","region":"Grand Est","phone":"+33(0)388756255","site":"https://www.afstrasbourg.eu/#/","postal":"67000","lat":48.57126,"lon":7.76776,"x":506.1,"y":163.5},{"id":96,"name":"Campus International de Cannes","city":"Cannes","region":"Provence-Alpes-Côte d'Azur","phone":"+33(0)493473929","site":"https://www.campusinternationalcannes.com/","postal":"06400","lat":43.55204,"lon":7.00478,"x":478.9,"y":458.3},{"id":97,"name":"Centre FLEURA - Université Clermont Auvergne","city":"Clermont-Ferrand","region":"Auvergne-Rhône-Alpes","phone":"+33(0)473406496","site":"http://www.uca.fr/international/centre-fleura/","postal":"63000","lat":45.78591,"lon":3.1154,"x":325.0,"y":329.4},{"id":98,"name":"Centre international d’études françaises (CIDEF) - Université catholique de l’ouest","city":"Angers","region":"Pays de la Loire","phone":"+33(0)241816630","site":"http://www.cidef.uco.fr/","postal":"49008","lat":47.5776,"lon":-0.96828,"x":163.4,"y":226.0},{"id":99,"name":"CILEC – Université Jean-Monnet","city":"Saint-Etienne","region":"Auvergne-Rhône-Alpes","phone":"+33(0)477437973","site":"https://cilec.univ-st-etienne.fr/fr/index.html","postal":"42023","lat":45.30381,"lon":4.566,"x":382.4,"y":357.2},{"id":100,"name":"CILFA (Centre International de Langue Française d’Annecy)","city":"Annecy","region":"Auvergne-Rhône-Alpes","phone":"+33(0)450091544","site":"https://www.cilfa.fr","postal":"74940","lat":45.90164,"lon":6.1181,"x":437.8,"y":322.7},{"id":101,"name":"DéFLE Université de Lorraine (Nancy)","city":"Nancy","region":"Grand Est","phone":"+33(0)372743196","site":"http://defle.univ-lorraine.fr/fr","postal":"54001","lat":48.89237,"lon":6.26549,"x":449.6,"y":150.2},{"id":102,"name":"Etoile Institut de Langue - Etablissement d'enseignement supérieur privé","city":"Paris","region":"Île-de-France","phone":"+33(0)145480005","site":"https://etoilegroupe.com/etoile-institut-2","postal":"75007","lat":48.85617,"lon":2.31215,"x":290.2,"y":147.1},{"id":103,"name":"Institut de français - Université d’Orléans (IDF-UO)","city":"Orléans","region":"Centre-Val de Loire","phone":"+33(0)238494503","site":"http://www.univ-orleans.fr/fr/idf","postal":"45065","lat":48.26284,"lon":2.28426,"x":292.1,"y":186.5},{"id":104,"name":"Institut d’études françaises (IEF) - La Rochelle Academy - Excelia Group","city":"La Rochelle","region":"Nouvelle-Aquitaine","phone":"+33(0)546517773","site":"https://www.ief-larochelle.fr","postal":"17000","lat":46.16242,"lon":-1.17348,"x":149.3,"y":307.7},{"id":105,"name":"Institut Supérieur de Propédeutique d’Amiens (ISPA)","city":"Amiens","region":"Hauts-de-France","phone":"+33(0)322910866","site":"https://www.amiens-ispa.fr","postal":"80000","lat":49.90041,"lon":2.28971,"x":292.3,"y":92.0},{"id":106,"name":"Institut universitaire des langues pour le FLE (IUL-FLE) - La Rochelle Université","city":"La Rochelle","region":"Nouvelle-Aquitaine","phone":"+33(0)546456823","site":"https://www.univ-larochelle.fr/international/apprendre-le-francais/etudier-le-francais/","postal":"17042","lat":45.83918,"lon":-0.45841,"x":183.6,"y":326.3},{"id":107,"name":"IS Aix en Provence","city":"Aix-en-Provence","region":"Provence-Alpes-Côte d'Azur","phone":"+33(0)442934790","site":"https://www.is-aix.com","postal":"13100","lat":43.78329,"lon":4.8533,"x":393.8,"y":444.9},{"id":108,"name":"Millefeuille Provence - centre résidentiel de français","city":"Saint-Geniès-de-Comolas","region":"Occitanie","phone":"+33(0)466502205","site":"https://www.millefeuille-provence.com","postal":"30150","lat":43.94652,"lon":4.0247,"x":361.0,"y":435.5},{"id":109,"name":"Service de FLE, Institut national des sciences appliquées de Lyon (INSA)","city":"Villeurbanne","region":"Auvergne-Rhône-Alpes","phone":"+33(0)472438366","site":"https://www.insa-lyon.fr/","postal":"69621","lat":45.771,"lon":4.88907,"x":395.2,"y":330.3}];

const OUTLINE_PATHS = ["M 580.0,539.0 L 566.9,583.6 L 549.0,571.9 L 539.8,533.0 L 547.8,511.6 L 573.3,489.6 L 580.0,539.0 Z","M 343.7,64.4 L 371.3,91.6 L 391.6,87.1 L 426.2,113.4 L 435.1,118.4 L 446.5,117.2 L 465.2,132.3 L 522.2,142.9 L 502.2,182.4 L 497.2,223.5 L 486.3,233.4 L 468.3,228.1 L 469.5,242.8 L 440.6,275.2 L 440.0,301.3 L 458.9,292.3 L 472.5,317.6 L 470.9,333.9 L 482.5,355.5 L 468.8,373.1 L 479.0,417.7 L 500.4,425.1 L 495.9,450.1 L 460.1,482.7 L 382.0,467.1 L 324.4,485.8 L 319.9,520.5 L 274.0,528.0 L 229.5,501.9 L 215.1,514.4 L 142.3,488.2 L 126.5,465.7 L 146.9,431.1 L 154.5,316.2 L 113.6,255.6 L 84.5,226.4 L 24.0,204.3 L 20.0,162.2 L 71.3,149.6 L 137.8,164.5 L 125.2,99.2 L 162.6,123.9 L 254.7,78.9 L 266.6,31.6 L 301.2,20.0 L 306.9,40.3 L 325.3,41.2 L 343.7,64.4 Z"];

const FULL_VB = { x: 0, y: 0, w: 600, h: 640 };
const ZOOM_W = 150, ZOOM_H = 170;

const CSS = `
.fle-tool{background:#fff;border:1px solid var(--borda);border-radius:var(--radius-md);box-shadow:var(--shadow-card);padding:22px;margin:28px 0;}
.fle-tool-head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
.fle-tool-head h3{margin:0;font-size:19px;}
.fle-count{font-size:12px;font-weight:600;color:var(--texto-secundario);white-space:nowrap;}
.fle-search{width:100%;font-family:var(--font-body);font-size:15px;color:var(--grafite);padding:12px 16px;border-radius:var(--radius-pill);border:1px solid var(--borda);background:var(--off-white-soft);margin-bottom:16px;}
.fle-search:focus{outline:2px solid var(--downtown-brown);outline-offset:1px;}
.fle-body{display:grid;grid-template-columns:260px 1fr;gap:16px;}
@media (max-width:760px){ .fle-body{grid-template-columns:1fr;} .fle-map{order:1;} .fle-list{order:2;} }
.fle-list{border:1px solid var(--borda);border-radius:var(--radius-sm);background:var(--off-white-soft);max-height:440px;overflow-y:auto;}
.fle-tool #centerList{list-style:none;margin:0;padding:0;}
.fle-tool #centerList li{padding:10px 14px;border-bottom:1px solid var(--borda-suave);cursor:pointer;}
.fle-tool #centerList li:last-child{border-bottom:none;}
.fle-tool #centerList li:hover{background:#fff;}
.fle-tool #centerList li.active{background:#fff;border-left:3px solid var(--downtown-brown);}
.fle-tool #centerList .name{font-size:13.5px;font-weight:600;color:var(--grafite);line-height:1.35;}
.fle-tool #centerList .meta{font-size:12px;color:var(--texto-secundario);margin-top:2px;}
.fle-no-results{padding:20px 14px;color:var(--texto-secundario);font-size:13.5px;}
.fle-map{border:1px solid var(--borda);border-radius:var(--radius-sm);background:var(--off-white-soft);overflow:hidden;position:relative;}
.fle-map svg{display:block;width:100%;height:auto;}
.fle-land{fill:var(--off-white);stroke:var(--borda);stroke-width:1.2;}
.fle-pin{fill:var(--beje-paris-text);stroke:#fff;stroke-width:0.8;cursor:pointer;transition:r .15s ease, fill .15s ease, opacity .15s ease;}
.fle-pin:hover{fill:var(--downtown-brown);}
.fle-pin.active{fill:var(--downtown-brown);r:7px;}
.fle-pin.dim{opacity:0.18;}
.fle-map-hint{position:absolute;left:10px;bottom:8px;font-size:10.5px;color:var(--texto-secundario);background:rgba(255,255,255,.8);padding:2px 7px;border-radius:20px;pointer-events:none;}
.fle-detail{margin-top:16px;border-top:1px solid var(--borda-suave);padding-top:16px;}
.fle-detail.is-empty p{color:var(--texto-secundario);font-size:13.5px;margin:0;}
.fle-detail-card h4{margin:0 0 4px;}
.fle-detail-card .sub{font-size:13px;color:var(--texto-secundario);margin-bottom:14px;}
.fle-detail-actions{display:flex;gap:8px;flex-wrap:wrap;}
.fle-detail-actions .btn{font-size:13px;padding:9px 16px;}
`;

const MARKUP = `
<div class="fle-tool">
  <div class="fle-tool-head">
    <h3>110 centros credenciados</h3>
    <span class="fle-count" id="toolCount">110 centros</span>
  </div>
  <input type="text" class="fle-search" id="search" placeholder="Busque por cidade, universidade ou sigla do diploma (ex.: Lyon, DUEF, Sorbonne...)">
  <div class="fle-body">
    <div class="fle-list"><ul id="centerList"></ul></div>
    <div class="fle-map">
      <svg id="franceMap" viewBox="0 0 600 640" xmlns="http://www.w3.org/2000/svg" aria-label="Mapa da França com os centros credenciados Qualité FLE">
        <g id="landGroup"></g>
        <g id="pinGroup"></g>
      </svg>
      <span class="fle-map-hint">clique num ponto ou na lista</span>
    </div>
  </div>
  <div class="fle-detail is-empty" id="detail">
    <p>Clique em um centro no mapa ou na lista pra ver o site oficial e a localização.</p>
  </div>
</div>
`;

function norm(s) {
  const lower = (s || "").toLowerCase().normalize("NFD");
  let out = "";
  for (let i = 0; i < lower.length; i++) {
    const code = lower.charCodeAt(i);
    if (code < 0x0300 || code > 0x036f) out += lower[i];
  }
  return out;
}

export function mount(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;

  if (!document.getElementById("fle-tool-css")) {
    const style = document.createElement("style");
    style.id = "fle-tool-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  root.innerHTML = MARKUP;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = root.querySelector("#franceMap");
  const landGroup = root.querySelector("#landGroup");
  const pinGroup = root.querySelector("#pinGroup");
  const listEl = root.querySelector("#centerList");
  const searchEl = root.querySelector("#search");
  const countEl = root.querySelector("#toolCount");
  const detailEl = root.querySelector("#detail");

  OUTLINE_PATHS.forEach((d) => {
    const p = document.createElementNS(svgNS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "fle-land");
    landGroup.appendChild(p);
  });

  PINS.forEach((pin) => {
    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("cx", pin.x);
    c.setAttribute("cy", pin.y);
    c.setAttribute("r", 3.6);
    c.setAttribute("class", "fle-pin");
    c.setAttribute("id", "pin-" + pin.id);
    c.addEventListener("click", () => selectPin(pin.id));
    pinGroup.appendChild(c);
  });

  let selectedId = null;

  function renderList() {
    const q = norm(searchEl.value);
    const items = PINS.filter(
      (p) => !q || norm(p.name + " " + p.city + " " + p.region).indexOf(q) !== -1
    ).sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));

    const filteredIds = {};
    items.forEach((p) => { filteredIds[p.id] = true; });

    countEl.textContent = items.length + (items.length === 1 ? " centro" : " centros") + (q ? " encontrados" : "");

    listEl.innerHTML = "";
    if (items.length === 0) {
      const li = document.createElement("li");
      li.className = "fle-no-results";
      li.textContent = "Nenhum centro encontrado com esse termo.";
      listEl.appendChild(li);
    } else {
      items.forEach((p) => {
        const li = document.createElement("li");
        li.className = p.id === selectedId ? "active" : "";
        li.innerHTML = '<div class="name">' + p.name + '</div><div class="meta">' + p.city + " — " + p.region + "</div>";
        li.addEventListener("click", () => selectPin(p.id));
        listEl.appendChild(li);
      });
    }

    PINS.forEach((p) => {
      root.querySelector("#pin-" + p.id).classList.toggle("dim", !filteredIds[p.id]);
    });
  }

  function renderDetail(pin) {
    if (!pin) {
      detailEl.className = "fle-detail is-empty";
      detailEl.innerHTML = "<p>Clique em um centro no mapa ou na lista pra ver o site oficial e a localização.</p>";
      return;
    }
    // Busca por nome + cidade (não só lat/lon) pra abrir a ficha real do
    // estabelecimento no Google Maps, em vez de um ponto solto sem nome.
    const mapsQuery = encodeURIComponent(pin.name + ", " + pin.postal + " " + pin.city + ", França");
    const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + mapsQuery;
    const phoneHtml = pin.phone && pin.phone !== "NULL" ? '<div class="sub">' + pin.phone + "</div>" : "";
    detailEl.className = "fle-detail";
    detailEl.innerHTML =
      '<div class="fle-detail-card">' +
        "<h4>" + pin.name + "</h4>" +
        '<div class="sub">' + pin.city + " (" + pin.postal + ") — " + pin.region + "</div>" +
        phoneHtml +
        '<div class="fle-detail-actions">' +
          '<a class="btn" href="' + pin.site + '" target="_blank" rel="noopener">Visitar site</a>' +
          '<a class="btn btn-outline" href="' + mapsUrl + '" target="_blank" rel="noopener">Ver no Google Maps</a>' +
          '<button class="btn btn-outline" type="button" id="clearSelBtn">Fechar</button>' +
        "</div>" +
      "</div>";
    detailEl.querySelector("#clearSelBtn").addEventListener("click", () => selectPin(null));
    if (typeof window.gtag === "function") {
      window.gtag("event", "select_content", { content_type: "centro_fle", item_id: pin.city });
    }
  }

  let currentVB = { x: 0, y: 0, w: 600, h: 640 };
  let tweenRaf = null;
  function tweenViewBox(target) {
    const from = { x: currentVB.x, y: currentVB.y, w: currentVB.w, h: currentVB.h };
    let start = null;
    const duration = 450;
    if (tweenRaf) cancelAnimationFrame(tweenRaf);
    function step(ts) {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      currentVB = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      };
      svg.setAttribute("viewBox", currentVB.x + " " + currentVB.y + " " + currentVB.w + " " + currentVB.h);
      if (t < 1) tweenRaf = requestAnimationFrame(step);
    }
    tweenRaf = requestAnimationFrame(step);
  }

  function selectPin(id) {
    selectedId = id;
    PINS.forEach((p) => {
      root.querySelector("#pin-" + p.id).classList.toggle("active", p.id === id);
    });
    renderList();
    if (id === null) {
      renderDetail(null);
      tweenViewBox(FULL_VB);
      return;
    }
    const pin = PINS.find((p) => p.id === id);
    renderDetail(pin);
    const target = {
      x: Math.max(0, Math.min(600 - ZOOM_W, pin.x - ZOOM_W / 2)),
      y: Math.max(0, Math.min(640 - ZOOM_H, pin.y - ZOOM_H / 2)),
      w: ZOOM_W,
      h: ZOOM_H,
    };
    tweenViewBox(target);
    const li = listEl.querySelector("li.active");
    if (li && li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
  }

  searchEl.addEventListener("input", renderList);

  renderList();
  renderDetail(null);
}
