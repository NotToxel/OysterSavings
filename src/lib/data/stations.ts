// Station-to-zone mapping for stations commonly found in TfL Oyster CSV exports
// Covers London Underground, National Rail, London Overground, DLR, Elizabeth line

export interface StationInfo {
  name: string;
  zone: number;
  altZone?: number; // stations on zone boundaries
  modes: ('underground' | 'national_rail' | 'overground' | 'dlr' | 'elizabeth')[];
  naptanId?: string; // TfL NaPTAN identifier for API fare lookups
}

// Map of canonical station names (lowercase) to their zone info
const STATIONS: Record<string, StationInfo> = {
  'abbey road dlr station': { name: 'Abbey Road DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLABR' },
  'abbey wood': { name: 'Abbey Wood', zone: 4, modes: ['national_rail', 'elizabeth'], naptanId: '910GABWDXR' },
  'abbey woodrail station': { name: 'Abbey Wood (London) Rail Station', zone: 4, modes: ['national_rail', 'elizabeth'], naptanId: '910GABWD' },
  'acton central rail station': { name: 'Acton Central Rail Station', zone: 3, modes: ['overground'], naptanId: '910GACTNCTL' },
  'acton main line rail station': { name: 'Acton Main Line Rail Station', zone: 3, modes: ['national_rail', 'elizabeth'], naptanId: '910GACTONML' },
  'acton town': { name: 'Acton Town', zone: 3, modes: ['underground'], naptanId: '940GZZLUACT' },
  'albany park rail station': { name: 'Albany Park Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GALBNYPK' },
  'aldgate east underground station': { name: 'Aldgate East Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUADE' },
  'aldgate underground station': { name: 'Aldgate Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUALD' },
  'alexandra palace rail station': { name: 'Alexandra Palace Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GALEXNDP' },
  'all saints dlr station': { name: 'All Saints DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLALL' },
  'alperton underground station': { name: 'Alperton Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUALP' },
  'amersham': { name: 'Amersham', zone: 9, modes: ['underground'], naptanId: '940GZZLUAMS' },
  'anerley rail station': { name: 'Anerley Rail Station', zone: 4, modes: ['national_rail', 'overground'], naptanId: '910GANERLEY' },
  'angel underground station': { name: 'Angel Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUAGL' },
  'archway underground station': { name: 'Archway Underground Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUACY' },
  'arnos grove underground station': { name: 'Arnos Grove Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUASG' },
  'arsenal underground station': { name: 'Arsenal Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUASL' },
  'baker street': { name: 'Baker Street', zone: 1, modes: ['underground'], naptanId: '940GZZLUBST' },
  'balham rail station': { name: 'Balham Rail Station', zone: 3, modes: ['underground', 'national_rail'], naptanId: '910GBALHAM' },
  'balham underground station': { name: 'Balham Underground Station', zone: 3, modes: ['underground', 'national_rail'], naptanId: '940GZZLUBLM' },
  'bank dlr station': { name: 'Bank DLR Station', zone: 1, modes: ['underground'], naptanId: '940GZZDLBNK' },
  'bank underground station': { name: 'Bank Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUBNK' },
  'banstead': { name: 'Banstead', zone: 6, modes: ['national_rail'], naptanId: '910GBANSTED' },
  'barbican underground station': { name: 'Barbican Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUBBN' },
  'barking rail station': { name: 'Barking Rail Station', zone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GBARKING' },
  'barking riverside': { name: 'Barking Riverside', zone: 4, modes: ['overground'], naptanId: '910GBARKRIV' },
  'barking underground station': { name: 'Barking Underground Station', zone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUBKG' },
  'barkingside underground station': { name: 'Barkingside Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUBKE' },
  'barnehurst rail station': { name: 'Barnehurst Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GBRNHRST' },
  'barnes bridge rail station': { name: 'Barnes Bridge Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GBNSBDGE' },
  'barnes rail station': { name: 'Barnes Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GBARNES' },
  'barons court underground station': { name: 'Barons Court Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUBSC' },
  'battersea park rail station': { name: 'Battersea Park Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GBATRSPK' },
  'battersea power station underground station': { name: 'Battersea Power Station Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZBPSUST' },
  'bayswater underground station': { name: 'Bayswater Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUBWT' },
  'beckenham hill rail station': { name: 'Beckenham Hill Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GBCKNHMH' },
  'beckenham junction rail station': { name: 'Beckenham Junction Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GBCKNMJC' },
  'beckton dlr station': { name: 'Beckton DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLBEC' },
  'beckton park dlr station': { name: 'Beckton Park DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLBPK' },
  'becontree underground station': { name: 'Becontree Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUBEC' },
  'bellingham rail station': { name: 'Bellingham Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GBELNGHM' },
  'belmont rail station': { name: 'Belmont Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GBELM' },
  'belsize park underground station': { name: 'Belsize Park Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUBZP' },
  'belvedere rail station': { name: 'Belvedere Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GBELVEDR' },
  'bermondsey underground station': { name: 'Bermondsey Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUBMY' },
  'berrylands rail station': { name: 'Berrylands Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GBRLANDS' },
  'bethnal green rail station': { name: 'Bethnal Green Rail Station', zone: 2, modes: ['underground', 'national_rail'], naptanId: '910GBTHNLGR' },
  'bethnal green underground station': { name: 'Bethnal Green Underground Station', zone: 2, modes: ['underground', 'national_rail'], naptanId: '940GZZLUBLG' },
  'bexley rail station': { name: 'Bexley Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GBEXLEY' },
  'bexleyheath rail station': { name: 'Bexleyheath Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GBXLYHTH' },
  'bickley rail station': { name: 'Bickley Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GBICKLEY' },
  'birkbeck rail station': { name: 'Birkbeck Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GBIRKBCK' },
  'blackfriars underground station': { name: 'Blackfriars Underground Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '940GZZLUBKF' },
  'blackheath rail station': { name: 'Blackheath Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GBLKHTH' },
  'blackhorse road': { name: 'Blackhorse Road', zone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUBLR' },
  'blackwall dlr station': { name: 'Blackwall DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLBLA' },
  'bond street': { name: 'Bond Street', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '910GBONDST' },
  'bond street underground station': { name: 'Bond Street Underground Station', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '940GZZLUBND' },
  'borough underground station': { name: 'Borough Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUBOR' },
  'boston manor underground station': { name: 'Boston Manor Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUBOS' },
  'bounds green underground station': { name: 'Bounds Green Underground Station', zone: 3, altZone: 4, modes: ['underground'], naptanId: '940GZZLUBDS' },
  'bow church dlr station': { name: 'Bow Church DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLBOW' },
  'bow road underground station': { name: 'Bow Road Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUBWR' },
  'bowes park rail station': { name: 'Bowes Park Rail Station', zone: 3, altZone: 4, modes: ['national_rail'], naptanId: '910GBOWESPK' },
  'brent cross': { name: 'Brent Cross', zone: 3, modes: ['underground'], naptanId: '940GZZLUBTX' },
  'brent cross west': { name: 'Brent Cross West', zone: 3, modes: ['national_rail'], naptanId: '910GBRENTX' },
  'brentford rail station': { name: 'Brentford Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GBNTFORD' },
  'brentwood': { name: 'Brentwood', zone: 9, modes: ['national_rail', 'elizabeth'], naptanId: '910GBRTWOOD' },
  'brimsdown rail station': { name: 'Brimsdown Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GBRIMSDN' },
  'brixton rail station': { name: 'Brixton Rail Station', zone: 2, modes: ['underground', 'national_rail'], naptanId: '910GBRIXTON' },
  'brixton underground station': { name: 'Brixton Underground Station', zone: 2, modes: ['underground', 'national_rail'], naptanId: '940GZZLUBXN' },
  'brockley rail station': { name: 'Brockley Rail Station', zone: 2, modes: ['national_rail', 'overground'], naptanId: '910GBROCKLY' },
  'bromley north rail station': { name: 'Bromley North Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GBROMLYN' },
  'bromley south rail station': { name: 'Bromley South Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GBROMLYS' },
  'bromley-by-bow underground station': { name: 'Bromley-by-Bow Underground Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUBBB' },
  'brondesbury park rail station': { name: 'Brondesbury Park Rail Station', zone: 2, modes: ['overground'], naptanId: '910GBRBYPK' },
  'brondesbury rail station': { name: 'Brondesbury Rail Station', zone: 2, modes: ['overground'], naptanId: '910GBRBY' },
  'bruce grove rail station': { name: 'Bruce Grove Rail Station', zone: 3, modes: ['overground'], naptanId: '910GBRUCGRV' },
  'buckhurst hill': { name: 'Buckhurst Hill', zone: 5, modes: ['underground'], naptanId: '940GZZLUBKH' },
  'burnt oak underground station': { name: 'Burnt Oak Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUBTK' },
  'bush hill park': { name: 'Bush Hill Park', zone: 5, modes: ['overground'], naptanId: '910GBHILLPK' },
  'caledonian road & barnsbury rail station': { name: 'Caledonian Road & Barnsbury Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GCLDNNRB' },
  'caledonian road underground station': { name: 'Caledonian Road Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUCAR' },
  'cambridge heathrail station': { name: 'Cambridge Heath (London) Rail Station', zone: 2, modes: ['overground'], naptanId: '910GCAMHTH' },
  'camden road rail station': { name: 'Camden Road Rail Station', zone: 2, modes: ['overground'], naptanId: '910GCMDNRD' },
  'camden town underground station': { name: 'Camden Town Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUCTN' },
  'canada water rail station': { name: 'Canada Water Rail Station', zone: 2, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GCNDAW' },
  'canada water underground station': { name: 'Canada Water Underground Station', zone: 2, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUCWR' },
  'canary wharf': { name: 'Canary Wharf', zone: 2, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '910GCANWHRF' },
  'canary wharf dlr station': { name: 'Canary Wharf DLR Station', zone: 2, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '940GZZDLCAN' },
  'canary wharf underground station': { name: 'Canary Wharf Underground Station', zone: 2, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '940GZZLUCYF' },
  'canning town dlr station': { name: 'Canning Town DLR Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZDLCGT' },
  'canning town underground station': { name: 'Canning Town Underground Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUCGT' },
  'cannon street underground station': { name: 'Cannon Street Underground Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '940GZZLUCST' },
  'canonbury rail station': { name: 'Canonbury Rail Station', zone: 2, modes: ['overground'], naptanId: '910GCNNB' },
  'canons park': { name: 'Canons Park', zone: 5, modes: ['underground'], naptanId: '940GZZLUCPK' },
  'carshalton beeches rail station': { name: 'Carshalton Beeches Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GCRSHLTB' },
  'carshalton rail station': { name: 'Carshalton Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GCRSHLTN' },
  'castle bar park': { name: 'Castle Bar Park', zone: 4, modes: ['national_rail'], naptanId: '910GCBARPAR' },
  'caterham': { name: 'Caterham', zone: 6, modes: ['national_rail'], naptanId: '910GCATERHM' },
  'catford bridge rail station': { name: 'Catford Bridge Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GCATFBDG' },
  'catford rail station': { name: 'Catford Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GCATFORD' },
  'chadwell heath rail station': { name: 'Chadwell Heath Rail Station', zone: 5, modes: ['national_rail', 'elizabeth'], naptanId: '910GCHDWLHT' },
  'chalfont & latimer': { name: 'Chalfont & Latimer', zone: 8, modes: ['underground'], naptanId: '940GZZLUCAL' },
  'chalk farm underground station': { name: 'Chalk Farm Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUCFM' },
  'chancery lane': { name: 'Chancery Lane', zone: 1, modes: ['underground'], naptanId: '940GZZLUCHL' },
  'charing cross underground station': { name: 'Charing Cross Underground Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '940GZZLUCHX' },
  'charlton rail station': { name: 'Charlton Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GCRLN' },
  'cheam rail station': { name: 'Cheam Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GCHEAM' },
  'chelsfield': { name: 'Chelsfield', zone: 6, modes: ['national_rail'], naptanId: '910GCHLSFLD' },
  'chesham': { name: 'Chesham', zone: 9, modes: ['underground'], naptanId: '940GZZLUCSM' },
  'chessington north rail station': { name: 'Chessington North Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GCHSSN' },
  'chessington south rail station': { name: 'Chessington South Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GCHSSS' },
  'chigwell': { name: 'Chigwell', zone: 4, modes: ['underground'], naptanId: '940GZZLUCWL' },
  'chingford rail station': { name: 'Chingford Rail Station', zone: 5, modes: ['overground'], naptanId: '910GCHINGFD' },
  'chipstead': { name: 'Chipstead', zone: 6, modes: ['national_rail'], naptanId: '910GCHSD' },
  'chislehurst rail station': { name: 'Chislehurst Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GCHSLHRS' },
  'chiswick park underground station': { name: 'Chiswick Park Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUCWP' },
  'chiswick rail station': { name: 'Chiswick Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GCHISWCK' },
  'chorleywood': { name: 'Chorleywood', zone: 7, modes: ['underground'], naptanId: '940GZZLUCYD' },
  'city thameslink rail station': { name: 'City Thameslink Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GCTMSLNK' },
  'clapham common underground station': { name: 'Clapham Common Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUCPC' },
  'clapham high street rail station': { name: 'Clapham High Street Rail Station', zone: 2, modes: ['overground'], naptanId: '910GCLPHHS' },
  'clapham junction rail station': { name: 'Clapham Junction Rail Station', zone: 2, modes: ['national_rail', 'overground'], naptanId: '910GCLPHMJW' },
  'clapham north underground station': { name: 'Clapham North Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUCPN' },
  'clapham south underground station': { name: 'Clapham South Underground Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUCPS' },
  'clapton rail station': { name: 'Clapton Rail Station', zone: 2, altZone: 3, modes: ['overground'], naptanId: '910GCLAPTON' },
  'clock house rail station': { name: 'Clock House Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GCLOCKHS' },
  'cockfosters underground station': { name: 'Cockfosters Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUCKS' },
  'colindale underground station': { name: 'Colindale Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUCND' },
  'colliers wood underground station': { name: 'Colliers Wood Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUCSD' },
  'coulsdon south rail station': { name: 'Coulsdon South Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GCOLSDNS' },
  'coulsdon town rail station': { name: 'Coulsdon Town Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GCOLSTWN' },
  'covent garden underground station': { name: 'Covent Garden Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUCGN' },
  'crayford rail station': { name: 'Crayford Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GCRFD' },
  'crews hill rail station': { name: 'Crews Hill Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GCRHL' },
  'cricklewood rail station': { name: 'Cricklewood Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GCRKLWD' },
  'crofton park rail station': { name: 'Crofton Park Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GCFPK' },
  'crossharbour dlr station': { name: 'Crossharbour DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLCLA' },
  'crouch hill rail station': { name: 'Crouch Hill Rail Station', zone: 3, modes: ['overground'], naptanId: '910GCROUCHH' },
  'croxley': { name: 'Croxley', zone: 7, modes: ['underground'], naptanId: '940GZZLUCXY' },
  'crystal palace rail station': { name: 'Crystal Palace Rail Station', zone: 3, altZone: 4, modes: ['national_rail', 'overground'], naptanId: '910GCRYSTLP' },
  'cuffley': { name: 'Cuffley', zone: 9, modes: ['national_rail'], naptanId: '910GCUFFLEY' },
  'custom house': { name: 'Custom House', zone: 3, modes: ['national_rail', 'elizabeth'], naptanId: '910GCUSTMHS' },
  'custom house (for excel) dlr station': { name: 'Custom House (for ExCel) DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLCUS' },
  'cutty sark (for maritime greenwich) dlr station': { name: 'Cutty Sark (for Maritime Greenwich) DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLCUT' },
  'cyprus dlr station': { name: 'Cyprus DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLCYP' },
  'dagenham dock rail station': { name: 'Dagenham Dock Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GDGNHMDC' },
  'dagenham east': { name: 'Dagenham East', zone: 5, modes: ['underground'], naptanId: '940GZZLUDGE' },
  'dagenham heathway underground station': { name: 'Dagenham Heathway Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUDGY' },
  'dalston junction rail station': { name: 'Dalston Junction Rail Station', zone: 2, modes: ['overground'], naptanId: '910GDALS' },
  'dalston kingsland rail station': { name: 'Dalston Kingsland Rail Station', zone: 2, modes: ['overground'], naptanId: '910GDALSKLD' },
  'debden': { name: 'Debden', zone: 6, modes: ['underground'], naptanId: '940GZZLUDBN' },
  'denmark hill rail station': { name: 'Denmark Hill Rail Station', zone: 2, modes: ['national_rail', 'overground'], naptanId: '910GDENMRKH' },
  'deptford bridge dlr station': { name: 'Deptford Bridge DLR Station', zone: 2, altZone: 3, modes: ['dlr'], naptanId: '940GZZDLDEP' },
  'deptford rail station': { name: 'Deptford Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GDEPTFD' },
  'dollis hill underground station': { name: 'Dollis Hill Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUDOH' },
  'drayton green rail station': { name: 'Drayton Green Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GDRAYGRN' },
  'drayton park rail station': { name: 'Drayton Park Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GDRYP' },
  'ealing broadway': { name: 'Ealing Broadway', zone: 3, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '940GZZLUEBY' },
  'ealing common': { name: 'Ealing Common', zone: 3, modes: ['underground'], naptanId: '940GZZLUECM' },
  'earlsfield rail station': { name: 'Earlsfield Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GERLFLD' },
  'east acton': { name: 'East Acton', zone: 2, modes: ['underground'], naptanId: '940GZZLUEAN' },
  'east croydon rail station': { name: 'East Croydon Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GECROYDN' },
  'east dulwich': { name: 'East Dulwich', zone: 2, modes: ['national_rail'], naptanId: '910GEDULWCH' },
  'east finchley underground station': { name: 'East Finchley Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUEFY' },
  'east ham underground station': { name: 'East Ham Underground Station', zone: 3, altZone: 4, modes: ['underground'], naptanId: '940GZZLUEHM' },
  'east india dlr station': { name: 'East India DLR Station', zone: 2, altZone: 3, modes: ['dlr'], naptanId: '940GZZDLEIN' },
  'east putney underground station': { name: 'East Putney Underground Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUEPY' },
  'eastcote underground station': { name: 'Eastcote Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUEAE' },
  'eden park rail station': { name: 'Eden Park Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GEDPK' },
  'edgware road': { name: 'Edgware Road', zone: 1, modes: ['underground'], naptanId: '940GZZLUERB' },
  'edgware underground station': { name: 'Edgware Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUEGW' },
  'edmonton green rail station': { name: 'Edmonton Green Rail Station', zone: 4, modes: ['national_rail', 'overground'], naptanId: '910GEDMNGRN' },
  'elephant & castle rail station': { name: 'Elephant & Castle Rail Station', zone: 1, altZone: 2, modes: ['underground', 'national_rail'], naptanId: '910GELPHNAC' },
  'elephant & castle underground station': { name: 'Elephant & Castle Underground Station', zone: 1, altZone: 2, modes: ['underground', 'national_rail'], naptanId: '940GZZLUEAC' },
  'elm park underground station': { name: 'Elm Park Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLUEPK' },
  'elmers end rail station': { name: 'Elmers End Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GELMERSE' },
  'elmstead woods rail station': { name: 'Elmstead Woods Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GELMW' },
  'elstree & borehamwood': { name: 'Elstree & Borehamwood', zone: 6, modes: ['national_rail'], naptanId: '910GELTR' },
  'eltham rail station': { name: 'Eltham Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GELTHAM' },
  'embankment underground station': { name: 'Embankment Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUEMB' },
  'emerson park rail station': { name: 'Emerson Park Rail Station', zone: 6, modes: ['overground'], naptanId: '910GEMRSPKH' },
  'enfield chase': { name: 'Enfield Chase', zone: 5, modes: ['national_rail'], naptanId: '910GENFC' },
  'enfield lock rail station': { name: 'Enfield Lock Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GENFLDLK' },
  'enfield town': { name: 'Enfield Town', zone: 5, modes: ['overground'], naptanId: '910GENFLDTN' },
  'epping': { name: 'Epping', zone: 6, modes: ['underground'], naptanId: '940GZZLUEPG' },
  'epsom downs': { name: 'Epsom Downs', zone: 6, modes: ['national_rail'], naptanId: '910GEPSDNS' },
  'erith rail station': { name: 'Erith Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GERITH' },
  'essex road rail station': { name: 'Essex Road Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GESSEXRD' },
  'euston square underground station': { name: 'Euston Square Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUESQ' },
  'euston underground station': { name: 'Euston Underground Station', zone: 1, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUEUS' },
  'ewell east': { name: 'Ewell East', zone: 6, modes: ['national_rail'], naptanId: '910GEWELLE' },
  'ewell west': { name: 'Ewell West', zone: 6, modes: ['national_rail'], naptanId: '910GEWELW' },
  'fairlop underground station': { name: 'Fairlop Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUFLP' },
  'falconwood rail station': { name: 'Falconwood Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GFALCNWD' },
  'farringdon': { name: 'Farringdon', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '910GFRNDXR' },
  'farringdon rail station': { name: 'Farringdon Rail Station', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '910GFRNDNLT' },
  'farringdon underground station': { name: 'Farringdon Underground Station', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '940GZZLUFCN' },
  'feltham rail station': { name: 'Feltham Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GFELTHAM' },
  'fenchurch street': { name: 'Fenchurch Street', zone: 1, modes: ['national_rail'], naptanId: '910GFENCHRS' },
  'finchley central': { name: 'Finchley Central', zone: 4, modes: ['underground'], naptanId: '940GZZLUFYC' },
  'finchley road': { name: 'Finchley Road', zone: 2, modes: ['underground'], naptanId: '940GZZLUFYR' },
  'finchley road & frognal rail station': { name: 'Finchley Road & Frognal Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GFNCHLYR' },
  'finsbury park rail station': { name: 'Finsbury Park Rail Station', zone: 2, modes: ['underground', 'national_rail'], naptanId: '910GFNPK' },
  'finsbury park underground station': { name: 'Finsbury Park Underground Station', zone: 2, modes: ['underground', 'national_rail'], naptanId: '940GZZLUFPK' },
  'forest gate rail station': { name: 'Forest Gate Rail Station', zone: 3, modes: ['national_rail', 'elizabeth'], naptanId: '910GFRSTGT' },
  'forest hill rail station': { name: 'Forest Hill Rail Station', zone: 3, modes: ['national_rail', 'overground'], naptanId: '910GFORESTH' },
  'fulham broadway': { name: 'Fulham Broadway', zone: 2, modes: ['underground'], naptanId: '940GZZLUFBY' },
  'fulwell rail station': { name: 'Fulwell Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GFULWELL' },
  'gallions reach dlr station': { name: 'Gallions Reach DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLGAL' },
  'gants hill underground station': { name: 'Gants Hill Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUGTH' },
  'gidea park': { name: 'Gidea Park', zone: 6, modes: ['national_rail', 'elizabeth'], naptanId: '910GGIDEAPK' },
  'gipsy hill': { name: 'Gipsy Hill', zone: 3, modes: ['national_rail'], naptanId: '910GGIPSYH' },
  'gloucester road': { name: 'Gloucester Road', zone: 1, modes: ['underground'], naptanId: '940GZZLUGTR' },
  'golders green underground station': { name: 'Golders Green Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUGGN' },
  'goldhawk road underground station': { name: 'Goldhawk Road Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUGHK' },
  'goodge street underground station': { name: 'Goodge Street Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUGDG' },
  'goodmayes rail station': { name: 'Goodmayes Rail Station', zone: 4, modes: ['national_rail', 'elizabeth'], naptanId: '910GGODMAYS' },
  'gordon hill': { name: 'Gordon Hill', zone: 5, modes: ['national_rail'], naptanId: '910GGORDONH' },
  'gospel oak rail station': { name: 'Gospel Oak Rail Station', zone: 2, modes: ['overground'], naptanId: '910GGOSPLOK' },
  'grange hill': { name: 'Grange Hill', zone: 4, modes: ['underground'], naptanId: '940GZZLUGGH' },
  'grange park': { name: 'Grange Park', zone: 5, modes: ['national_rail'], naptanId: '910GGRPK' },
  'great portland street underground station': { name: 'Great Portland Street Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUGPS' },
  'green park underground station': { name: 'Green Park Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUGPK' },
  'greenford rail station': { name: 'Greenford Rail Station', zone: 4, modes: ['underground', 'national_rail'], naptanId: '910GGFORD' },
  'greenford underground station': { name: 'Greenford Underground Station', zone: 4, modes: ['underground', 'national_rail'], naptanId: '940GZZLUGFD' },
  'greenwich dlr station': { name: 'Greenwich DLR Station', zone: 2, altZone: 3, modes: ['national_rail'], naptanId: '940GZZDLGRE' },
  'greenwich peninsula': { name: 'Greenwich Peninsula', zone: 6, modes: ['underground'], naptanId: '940GZZALGWP' },
  'greenwich rail station': { name: 'Greenwich Rail Station', zone: 2, altZone: 3, modes: ['national_rail'], naptanId: '910GGNWH' },
  'grove park rail station': { name: 'Grove Park Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GGRVPK' },
  'gunnersbury rail station': { name: 'Gunnersbury Rail Station', zone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GGNRSBRY' },
  'gunnersbury underground station': { name: 'Gunnersbury Underground Station', zone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUGBY' },
  'hackbridge rail station': { name: 'Hackbridge Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GHKBG' },
  'hackney central rail station': { name: 'Hackney Central Rail Station', zone: 2, modes: ['overground'], naptanId: '910GHACKNYC' },
  'hackney downs rail station': { name: 'Hackney Downs Rail Station', zone: 2, modes: ['overground', 'national_rail'], naptanId: '910GHAKNYNM' },
  'hackney wick rail station': { name: 'Hackney Wick Rail Station', zone: 2, modes: ['overground'], naptanId: '910GHACKNYW' },
  'hadley wood rail station': { name: 'Hadley Wood Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GHADLYWD' },
  'haggerston rail station': { name: 'Haggerston Rail Station', zone: 2, modes: ['overground'], naptanId: '910GHAGGERS' },
  'hainault underground station': { name: 'Hainault Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUHLT' },
  'hammersmith': { name: 'Hammersmith', zone: 2, modes: ['underground'], naptanId: '940GZZLUHSD' },
  'hammersmith (dist&picc line) underground station': { name: 'Hammersmith (Dist&Picc Line) Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUHSD' },
  'hammersmith (h&c line) underground station': { name: 'Hammersmith (H&C Line) Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUHSC' },
  'hampstead heath rail station': { name: 'Hampstead Heath Rail Station', zone: 2, modes: ['overground'], naptanId: '910GHMPSTDH' },
  'hampstead underground station': { name: 'Hampstead Underground Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUHTD' },
  'hampton court': { name: 'Hampton Court', zone: 6, modes: ['national_rail'], naptanId: '910GHCRT' },
  'hampton wick rail station': { name: 'Hampton Wick Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GHAMWICK' },
  'hamptonrail station': { name: 'Hampton (London) Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GHAMPTON' },
  'hanger lane underground station': { name: 'Hanger Lane Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUHGR' },
  'hanwell rail station': { name: 'Hanwell Rail Station', zone: 4, modes: ['national_rail', 'elizabeth'], naptanId: '910GHANWELL' },
  'harlesden rail station': { name: 'Harlesden Rail Station', zone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GHARLSDN' },
  'harlesden underground station': { name: 'Harlesden Underground Station', zone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUHSN' },
  'harold wood': { name: 'Harold Wood', zone: 6, modes: ['national_rail', 'elizabeth'], naptanId: '910GHRLDWOD' },
  'harringay green lanes rail station': { name: 'Harringay Green Lanes Rail Station', zone: 3, modes: ['overground'], naptanId: '910GHRGYGL' },
  'harringay rail station': { name: 'Harringay Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GHRGY' },
  'harrow & wealdstone rail station': { name: 'Harrow & Wealdstone Rail Station', zone: 5, modes: ['underground', 'national_rail'], naptanId: '910GHROWDC' },
  'harrow-on-the-hill underground station': { name: 'Harrow-on-the-Hill Underground Station', zone: 5, modes: ['underground', 'national_rail'], naptanId: '940GZZLUHOH' },
  'hatch end rail station': { name: 'Hatch End Rail Station', zone: 6, modes: ['overground'], naptanId: '910GHTCHEND' },
  'hatton cross underground station': { name: 'Hatton Cross Underground Station', zone: 5, altZone: 6, modes: ['underground'], naptanId: '940GZZLUHNX' },
  'haydons road rail station': { name: 'Haydons Road Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GHYDNSRD' },
  'hayes': { name: 'Hayes', zone: 5, modes: ['national_rail'], naptanId: '910GHAYS' },
  'hayes & harlington rail station': { name: 'Hayes & Harlington Rail Station', zone: 5, modes: ['national_rail', 'elizabeth'], naptanId: '910GHAYESAH' },
  'hayes (kent) rail station': { name: 'Hayes (Kent) Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GHAYS' },
  'headstone lane rail station': { name: 'Headstone Lane Rail Station', zone: 5, modes: ['overground'], naptanId: '910GHEDSTNL' },
  'heathrow terminal 4': { name: 'Heathrow Terminal 4', zone: 6, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '940GZZLUHR4' },
  'heathrow terminal 4 rail station': { name: 'Heathrow Terminal 4 Rail Station', zone: 6, modes: ['national_rail', 'elizabeth'], naptanId: '910GHTRWTM4' },
  'heathrow terminal 5': { name: 'Heathrow Terminal 5', zone: 6, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '940GZZLUHR5' },
  'heathrow terminal 5 rail station': { name: 'Heathrow Terminal 5 Rail Station', zone: 6, modes: ['national_rail', 'elizabeth'], naptanId: '910GHTRWTM5' },
  'heathrow terminals 2 & 3': { name: 'Heathrow Terminals 2 & 3', zone: 6, modes: ['underground'], naptanId: '940GZZLUHRC' },
  'heathrow terminals 2 & 3 rail station': { name: 'Heathrow Terminals 2 & 3 Rail Station', zone: 6, modes: ['national_rail', 'elizabeth'], naptanId: '910GHTRWAPT' },
  'hendon central': { name: 'Hendon Central', zone: 3, altZone: 4, modes: ['underground'], naptanId: '940GZZLUHCL' },
  'hendon rail station': { name: 'Hendon Rail Station', zone: 3, altZone: 4, modes: ['national_rail'], naptanId: '910GHDON' },
  'herne hill rail station': { name: 'Herne Hill Rail Station', zone: 2, altZone: 3, modes: ['national_rail'], naptanId: '910GHERNEH' },
  'heron quays dlr station': { name: 'Heron Quays DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLHEQ' },
  'high barnet underground station': { name: 'High Barnet Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUHBT' },
  'high street kensington': { name: 'High Street Kensington', zone: 1, modes: ['underground'], naptanId: '940GZZLUHSK' },
  'highams park rail station': { name: 'Highams Park Rail Station', zone: 4, modes: ['overground'], naptanId: '910GHGHMSPK' },
  'highbury & islington rail station': { name: 'Highbury & Islington Rail Station', zone: 2, modes: ['underground', 'national_rail'], naptanId: '910GHIGHBYA' },
  'highbury & islington underground station': { name: 'Highbury & Islington Underground Station', zone: 2, modes: ['underground', 'national_rail'], naptanId: '940GZZLUHAI' },
  'highgate underground station': { name: 'Highgate Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUHGT' },
  'hillingdon underground station': { name: 'Hillingdon Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLUHGD' },
  'hither green rail station': { name: 'Hither Green Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GHTHRGRN' },
  'holborn underground station': { name: 'Holborn Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUHBN' },
  'holland park underground station': { name: 'Holland Park Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUHPK' },
  'holloway road underground station': { name: 'Holloway Road Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUHWY' },
  'homerton': { name: 'Homerton', zone: 2, modes: ['overground'], naptanId: '910GHOMRTON' },
  'honor oak park rail station': { name: 'Honor Oak Park Rail Station', zone: 3, modes: ['national_rail', 'overground'], naptanId: '910GHONROPK' },
  'hornchurch underground station': { name: 'Hornchurch Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLUHCH' },
  'hornsey rail station': { name: 'Hornsey Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GHRNSY' },
  'hounslow central': { name: 'Hounslow Central', zone: 4, modes: ['underground'], naptanId: '940GZZLUHWC' },
  'hounslow east': { name: 'Hounslow East', zone: 4, modes: ['underground'], naptanId: '940GZZLUHWE' },
  'hounslow rail station': { name: 'Hounslow Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GHOUNSLW' },
  'hounslow west': { name: 'Hounslow West', zone: 5, modes: ['underground'], naptanId: '940GZZLUHWT' },
  'hoxton rail station': { name: 'Hoxton Rail Station', zone: 1, altZone: 2, modes: ['overground'], naptanId: '910GHOXTON' },
  'hyde park corner underground station': { name: 'Hyde Park Corner Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUHPC' },
  'ickenham underground station': { name: 'Ickenham Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLUICK' },
  'ilford rail station': { name: 'Ilford Rail Station', zone: 4, modes: ['national_rail', 'elizabeth'], naptanId: '910GILFORD' },
  'imperial wharf rail station': { name: 'Imperial Wharf Rail Station', zone: 2, modes: ['national_rail', 'overground'], naptanId: '910GCSEAH' },
  'island gardens dlr station': { name: 'Island Gardens DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLISL' },
  'isleworth rail station': { name: 'Isleworth Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GISLEWTH' },
  'kenley rail station': { name: 'Kenley Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GKNLY' },
  'kennington underground station': { name: 'Kennington Underground Station', zone: 1, altZone: 2, modes: ['underground'], naptanId: '940GZZLUKNG' },
  'kensal green rail station': { name: 'Kensal Green Rail Station', zone: 2, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GKENSLG' },
  'kensal green underground station': { name: 'Kensal Green Underground Station', zone: 2, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUKSL' },
  'kensal rise rail station': { name: 'Kensal Rise Rail Station', zone: 2, modes: ['overground'], naptanId: '910GKENR' },
  'kensington (olympia) rail station': { name: 'Kensington (Olympia) Rail Station', zone: 2, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GKENOLYM' },
  'kensington (olympia) underground station': { name: 'Kensington (Olympia) Underground Station', zone: 2, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUKOY' },
  'kent house rail station': { name: 'Kent House Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GKENTHOS' },
  'kentish town rail station': { name: 'Kentish Town Rail Station', zone: 2, modes: ['underground', 'national_rail'], naptanId: '910GKNTSHTN' },
  'kentish town underground station': { name: 'Kentish Town Underground Station', zone: 2, modes: ['underground', 'national_rail'], naptanId: '940GZZLUKSH' },
  'kentish town west rail station': { name: 'Kentish Town West Rail Station', zone: 2, modes: ['overground'], naptanId: '910GKNTSHTW' },
  'kenton': { name: 'Kenton', zone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUKEN' },
  'kew bridge rail station': { name: 'Kew Bridge Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GKEWBDGE' },
  'kew gardens rail station': { name: 'Kew Gardens Rail Station', zone: 3, altZone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GKEWGRDN' },
  'kidbrooke rail station': { name: 'Kidbrooke Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GKIDBROK' },
  'kilburn high road rail station': { name: 'Kilburn High Road Rail Station', zone: 2, modes: ['overground'], naptanId: '910GKLBRNHR' },
  'kilburn park': { name: 'Kilburn Park', zone: 2, modes: ['underground'], naptanId: '940GZZLUKPK' },
  'kilburn underground station': { name: 'Kilburn Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUKBN' },
  'king george v dlr station': { name: 'King George V DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLKGV' },
  'king\'s cross st. pancras underground station': { name: 'King\'s Cross St. Pancras Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUKSX' },
  'kingsbury underground station': { name: 'Kingsbury Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUKBY' },
  'kingston rail station': { name: 'Kingston Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GKGSTON' },
  'kingswood': { name: 'Kingswood', zone: 6, modes: ['national_rail'], naptanId: '910GKGWD' },
  'knightsbridge underground station': { name: 'Knightsbridge Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUKNB' },
  'knockholt': { name: 'Knockholt', zone: 6, modes: ['national_rail'], naptanId: '910GKNCKHLT' },
  'ladbroke grove underground station': { name: 'Ladbroke Grove Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLULAD' },
  'ladywell': { name: 'Ladywell', zone: 3, modes: ['national_rail'], naptanId: '910GLDYW' },
  'lambeth north': { name: 'Lambeth North', zone: 1, modes: ['underground'], naptanId: '940GZZLULBN' },
  'lancaster gate underground station': { name: 'Lancaster Gate Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLULGT' },
  'langdon park dlr station': { name: 'Langdon Park DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLLDP' },
  'latimer road underground station': { name: 'Latimer Road Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLULRD' },
  'lea bridge rail station': { name: 'Lea Bridge Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GLEABDGE' },
  'lee rail station': { name: 'Lee Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GLEEE' },
  'leicester square underground station': { name: 'Leicester Square Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLULSQ' },
  'lewisham dlr station': { name: 'Lewisham DLR Station', zone: 2, altZone: 3, modes: ['national_rail'], naptanId: '940GZZDLLEW' },
  'lewisham rail station': { name: 'Lewisham Rail Station', zone: 2, altZone: 3, modes: ['national_rail'], naptanId: '910GLEWISHM' },
  'leyton midland road rail station': { name: 'Leyton Midland Road Rail Station', zone: 3, modes: ['overground'], naptanId: '910GLEYTNMR' },
  'leyton underground station': { name: 'Leyton Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLULYN' },
  'leytonstone high road rail station': { name: 'Leytonstone High Road Rail Station', zone: 3, modes: ['overground'], naptanId: '910GLYTNSHR' },
  'leytonstone underground station': { name: 'Leytonstone Underground Station', zone: 3, altZone: 4, modes: ['underground'], naptanId: '940GZZLULYS' },
  'limehouse dlr station': { name: 'Limehouse DLR Station', zone: 2, modes: ['national_rail'], naptanId: '940GZZDLLIM' },
  'limehouse rail station': { name: 'Limehouse Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GLIMHSE' },
  'liverpool street': { name: 'Liverpool Street', zone: 1, modes: ['elizabeth', 'national_rail', 'overground', 'underground'], naptanId: '910GLIVSTLL' },
  'liverpool street underground station': { name: 'Liverpool Street Underground Station', zone: 1, modes: ['elizabeth', 'national_rail', 'overground', 'underground'], naptanId: '940GZZLULVT' },
  'london blackfriars rail station': { name: 'London Blackfriars Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GBLFR' },
  'london bridge rail station': { name: 'London Bridge Rail Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '910GLNDNBDE' },
  'london bridge underground station': { name: 'London Bridge Underground Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '940GZZLULNB' },
  'london cannon street rail station': { name: 'London Cannon Street Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GCANONST' },
  'london charing cross rail station': { name: 'London Charing Cross Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GCHRX' },
  'london city airport dlr station': { name: 'London City Airport DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLLCA' },
  'london euston rail station': { name: 'London Euston Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GEUSTON' },
  'london fenchurch street rail station': { name: 'London Fenchurch Street Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GFENCHRS' },
  'london fields rail station': { name: 'London Fields Rail Station', zone: 2, modes: ['overground'], naptanId: '910GLONFLDS' },
  'london kings cross rail station': { name: 'London Kings Cross Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GKNGX' },
  'london liverpool street rail station': { name: 'London Liverpool Street Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GLIVST' },
  'london marylebone rail station': { name: 'London Marylebone Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GMARYLBN' },
  'london paddington rail station': { name: 'London Paddington Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GPADTON' },
  'london st pancras international ll rail station': { name: 'London St Pancras International LL Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GSTPXBOX' },
  'london st pancras international rail station': { name: 'London St Pancras International Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GSTPX' },
  'london victoria rail station': { name: 'London Victoria Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GVICTRIE' },
  'london waterloo east rail station': { name: 'London Waterloo East Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GWLOE' },
  'london waterloo rail station': { name: 'London Waterloo Rail Station', zone: 1, modes: ['national_rail'], naptanId: '910GWATRLMN' },
  'loughborough junction rail station': { name: 'Loughborough Junction Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GLBGHJN' },
  'loughton': { name: 'Loughton', zone: 6, modes: ['underground'], naptanId: '940GZZLULGN' },
  'lower sydenham rail station': { name: 'Lower Sydenham Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GLSYDNHM' },
  'maida vale underground station': { name: 'Maida Vale Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUMVL' },
  'malden manor rail station': { name: 'Malden Manor Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GMALDENM' },
  'manor house underground station': { name: 'Manor House Underground Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUMRH' },
  'manor park rail station': { name: 'Manor Park Rail Station', zone: 3, altZone: 4, modes: ['national_rail', 'elizabeth'], naptanId: '910GMANRPK' },
  'mansion house underground station': { name: 'Mansion House Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUMSH' },
  'marble arch underground station': { name: 'Marble Arch Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUMBA' },
  'maryland rail station': { name: 'Maryland Rail Station', zone: 3, modes: ['national_rail', 'elizabeth'], naptanId: '910GMRYLAND' },
  'marylebone underground station': { name: 'Marylebone Underground Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '940GZZLUMYB' },
  'maze hill rail station': { name: 'Maze Hill Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GMAZEH' },
  'meridian water rail station': { name: 'Meridian Water Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GMWRWSTN' },
  'mile end underground station': { name: 'Mile End Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUMED' },
  'mill hill broadway rail station': { name: 'Mill Hill Broadway Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GMLHB' },
  'mill hill east underground station': { name: 'Mill Hill East Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUMHL' },
  'mitcham eastfields rail station': { name: 'Mitcham Eastfields Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GESTFLDS' },
  'mitcham junction rail station': { name: 'Mitcham Junction Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GMITCHMJ' },
  'monument underground station': { name: 'Monument Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUMMT' },
  'moor park': { name: 'Moor Park', zone: 6, altZone: 7, modes: ['underground'], naptanId: '940GZZLUMPK' },
  'moorgate rail station': { name: 'Moorgate Rail Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '910GMRGT' },
  'moorgate underground station': { name: 'Moorgate Underground Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '940GZZLUMGT' },
  'morden south rail station': { name: 'Morden South Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GMORDENS' },
  'morden underground station': { name: 'Morden Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUMDN' },
  'mornington crescent': { name: 'Mornington Crescent', zone: 2, modes: ['underground'], naptanId: '940GZZLUMTC' },
  'mortlake rail station': { name: 'Mortlake Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GMRTLKE' },
  'motspur park rail station': { name: 'Motspur Park Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GMOTSPRP' },
  'mottingham rail station': { name: 'Mottingham Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GMOTNGHM' },
  'mudchute dlr station': { name: 'Mudchute DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLMUD' },
  'neasden underground station': { name: 'Neasden Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUNDN' },
  'new barnet rail station': { name: 'New Barnet Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GNBARNET' },
  'new beckenham rail station': { name: 'New Beckenham Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GNBCKNHM' },
  'new cross ell rail station': { name: 'New Cross ELL Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GNWCRELL' },
  'new cross gate ell rail station': { name: 'New Cross Gate ELL Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GNEWXGEL' },
  'new cross gate rail station': { name: 'New Cross Gate Rail Station', zone: 2, modes: ['national_rail', 'overground'], naptanId: '910GNEWXGTE' },
  'new cross rail station': { name: 'New Cross Rail Station', zone: 2, modes: ['national_rail', 'overground'], naptanId: '910GNWCROSS' },
  'new eltham rail station': { name: 'New Eltham Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GNWELTHM' },
  'new malden rail station': { name: 'New Malden Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GNEWMLDN' },
  'new southgate rail station': { name: 'New Southgate Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GNEWSGAT' },
  'newbury park station': { name: 'Newbury Park Station', zone: 4, modes: ['national_rail'], naptanId: '910GILFENBP' },
  'newbury park underground station': { name: 'Newbury Park Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUNBP' },
  'nine elms underground station': { name: 'Nine Elms Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZNEUGST' },
  'norbiton rail station': { name: 'Norbiton Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GNRBITON' },
  'norbury rail station': { name: 'Norbury Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GNORBURY' },
  'north acton': { name: 'North Acton', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUNAN' },
  'north dulwich': { name: 'North Dulwich', zone: 2, altZone: 3, modes: ['national_rail'], naptanId: '910GNDULWCH' },
  'north ealing': { name: 'North Ealing', zone: 3, modes: ['underground'], naptanId: '940GZZLUNEN' },
  'north greenwich underground station': { name: 'North Greenwich Underground Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUNGW' },
  'north harrow': { name: 'North Harrow', zone: 5, modes: ['underground'], naptanId: '940GZZLUNHA' },
  'north sheen rail station': { name: 'North Sheen Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GNSHEEN' },
  'north wembley rail station': { name: 'North Wembley Rail Station', zone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GNWEMBLY' },
  'north wembley underground station': { name: 'North Wembley Underground Station', zone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUNWY' },
  'northfields underground station': { name: 'Northfields Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUNFD' },
  'northolt park rail station': { name: 'Northolt Park Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GNTHOLTP' },
  'northolt underground station': { name: 'Northolt Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUNHT' },
  'northumberland park rail station': { name: 'Northumberland Park Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GNMBRLPK' },
  'northwick park': { name: 'Northwick Park', zone: 4, modes: ['underground'], naptanId: '940GZZLUNKP' },
  'northwood hills underground station': { name: 'Northwood Hills Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLUNWH' },
  'northwood underground station': { name: 'Northwood Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLUNOW' },
  'norwood junction rail station': { name: 'Norwood Junction Rail Station', zone: 4, modes: ['national_rail', 'overground'], naptanId: '910GNORWDJ' },
  'notting hill gate underground station': { name: 'Notting Hill Gate Underground Station', zone: 1, altZone: 2, modes: ['underground'], naptanId: '940GZZLUNHG' },
  'nunhead rail station': { name: 'Nunhead Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GNUNHEAD' },
  'oakleigh park rail station': { name: 'Oakleigh Park Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GOKLGHPK' },
  'oakwood underground station': { name: 'Oakwood Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUOAK' },
  'old street rail station': { name: 'Old Street Rail Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '910GOLDST' },
  'old street underground station': { name: 'Old Street Underground Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '940GZZLUODS' },
  'orpington rail station': { name: 'Orpington Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GORPNGTN' },
  'osterley underground station': { name: 'Osterley Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUOSY' },
  'oval': { name: 'Oval', zone: 2, modes: ['underground'], naptanId: '940GZZLUOVL' },
  'oxford circus underground station': { name: 'Oxford Circus Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUOXC' },
  'paddington': { name: 'Paddington', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '910GPADTLL' },
  'paddington (h&c line)-underground': { name: 'Paddington (H&C Line)-Underground', zone: 1, modes: ['underground'], naptanId: '940GZZLUPAH' },
  'paddington underground station': { name: 'Paddington Underground Station', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '940GZZLUPAC' },
  'palmers green rail station': { name: 'Palmers Green Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GPALMRSG' },
  'park royal underground station': { name: 'Park Royal Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUPKR' },
  'parsons green underground station': { name: 'Parsons Green Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUPSG' },
  'peckham rye rail station': { name: 'Peckham Rye Rail Station', zone: 2, modes: ['national_rail', 'overground'], naptanId: '910GPKHMRYC' },
  'penge east rail station': { name: 'Penge East Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GPNGEE' },
  'penge west rail station': { name: 'Penge West Rail Station', zone: 4, modes: ['national_rail', 'overground'], naptanId: '910GPENEW' },
  'perivale underground station': { name: 'Perivale Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUPVL' },
  'petts wood rail station': { name: 'Petts Wood Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GPETSWD' },
  'piccadilly circus underground station': { name: 'Piccadilly Circus Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUPCC' },
  'pimlico underground station': { name: 'Pimlico Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUPCO' },
  'pinner underground station': { name: 'Pinner Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUPNR' },
  'plaistow underground station': { name: 'Plaistow Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUPLW' },
  'plumstead rail station': { name: 'Plumstead Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GPLMS' },
  'ponders end rail station': { name: 'Ponders End Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GPNDRSEN' },
  'pontoon dock dlr station': { name: 'Pontoon Dock DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLPDK' },
  'poplar dlr station': { name: 'Poplar DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLPOP' },
  'preston road': { name: 'Preston Road', zone: 4, modes: ['underground'], naptanId: '940GZZLUPRD' },
  'prince regent': { name: 'Prince Regent', zone: 3, modes: ['dlr'], naptanId: '940GZZDLPRE' },
  'pudding mill lane dlr station': { name: 'Pudding Mill Lane DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLPUD' },
  'purley oaks rail station': { name: 'Purley Oaks Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GPURLEYO' },
  'purley rail station': { name: 'Purley Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GPURLEY' },
  'putney bridge underground station': { name: 'Putney Bridge Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUPYB' },
  'putney rail station': { name: 'Putney Rail Station', zone: 2, altZone: 3, modes: ['national_rail'], naptanId: '910GPUTNEY' },
  'queen\'s park underground station': { name: 'Queen\'s Park Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUQPS' },
  'queens parkrail station': { name: 'Queens Park (London) Rail Station', zone: 2, modes: ['national_rail', 'overground'], naptanId: '910GQPRK' },
  'queens road peckham rail station': { name: 'Queens Road Peckham Rail Station', zone: 2, modes: ['national_rail', 'overground'], naptanId: '910GPCKHMQD' },
  'queensbury underground station': { name: 'Queensbury Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUQBY' },
  'queenstown road (battersea) rail station': { name: 'Queenstown Road (Battersea) Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GQTRDBAT' },
  'queensway': { name: 'Queensway', zone: 1, modes: ['underground'], naptanId: '940GZZLUQWY' },
  'radlett': { name: 'Radlett', zone: 7, modes: ['national_rail'], naptanId: '910GRADLETT' },
  'rainhamrail station': { name: 'Rainham (London) Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GRNHAME' },
  'ravensbourne': { name: 'Ravensbourne', zone: 4, modes: ['national_rail'], naptanId: '910GRBRN' },
  'ravenscourt park underground station': { name: 'Ravenscourt Park Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLURVP' },
  'rayners lane underground station': { name: 'Rayners Lane Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLURYL' },
  'raynes park rail station': { name: 'Raynes Park Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GRAYNSPK' },
  'rectory road rail station': { name: 'Rectory Road Rail Station', zone: 2, modes: ['overground'], naptanId: '910GRCTRYRD' },
  'redbridge underground station': { name: 'Redbridge Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLURBG' },
  'reedham': { name: 'Reedham', zone: 6, modes: ['national_rail'], naptanId: '910GREEDHMS' },
  'reedham (surrey) rail station': { name: 'Reedham (Surrey) Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GREEDHMS' },
  'richmond nll rail station': { name: 'Richmond NLL Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GRICHNLL' },
  'richmond underground station': { name: 'Richmond Underground Station', zone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLURMD' },
  'richmondrail station': { name: 'Richmond (London) Rail Station', zone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GRICHMND' },
  'rickmansworth': { name: 'Rickmansworth', zone: 7, modes: ['underground'], naptanId: '940GZZLURKW' },
  'riddlesdown rail station': { name: 'Riddlesdown Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GRDLSDWN' },
  'roding valley underground station': { name: 'Roding Valley Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLURVY' },
  'romford rail station': { name: 'Romford Rail Station', zone: 6, modes: ['elizabeth', 'national_rail', 'overground'], naptanId: '910GROMFORD' },
  'rotherhithe rail station': { name: 'Rotherhithe Rail Station', zone: 2, modes: ['overground'], naptanId: '910GRTHERHI' },
  'royal albert dlr station': { name: 'Royal Albert DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLRAL' },
  'royal docks': { name: 'Royal Docks', zone: 6, modes: ['underground'], naptanId: '940GZZALRDK' },
  'royal oak underground station': { name: 'Royal Oak Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLURYO' },
  'royal victoria dlr station': { name: 'Royal Victoria DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLRVC' },
  'ruislip gardens underground station': { name: 'Ruislip Gardens Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLURSG' },
  'ruislip manor underground station': { name: 'Ruislip Manor Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLURSM' },
  'ruislip underground station': { name: 'Ruislip Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLURSP' },
  'russell square': { name: 'Russell Square', zone: 1, modes: ['underground'], naptanId: '940GZZLURSQ' },
  'sanderstead rail station': { name: 'Sanderstead Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GSDSD' },
  'selhurst': { name: 'Selhurst', zone: 4, modes: ['national_rail'], naptanId: '910GSELHRST' },
  'seven kings rail station': { name: 'Seven Kings Rail Station', zone: 4, modes: ['national_rail', 'elizabeth'], naptanId: '910GSVNKNGS' },
  'seven sisters rail station': { name: 'Seven Sisters Rail Station', zone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GSEVNSIS' },
  'seven sisters underground station': { name: 'Seven Sisters Underground Station', zone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUSVS' },
  'shadwell dlr station': { name: 'Shadwell DLR Station', zone: 2, modes: ['overground', 'dlr'], naptanId: '940GZZDLSHA' },
  'shadwell rail station': { name: 'Shadwell Rail Station', zone: 2, modes: ['overground', 'dlr'], naptanId: '910GSHADWEL' },
  'shepherd\'s bush (central) underground station': { name: 'Shepherd\'s Bush (Central) Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLUSBC' },
  'shepherd\'s bush market underground station': { name: 'Shepherd\'s Bush Market Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUSBM' },
  'shepherds bush rail station': { name: 'Shepherds Bush Rail Station', zone: 2, modes: ['national_rail', 'overground'], naptanId: '910GSHPDSB' },
  'shoreditch high street rail station': { name: 'Shoreditch High Street Rail Station', zone: 1, modes: ['overground'], naptanId: '910GSHRDHST' },
  'shortlands': { name: 'Shortlands', zone: 4, modes: ['national_rail'], naptanId: '910GSHRTLND' },
  'sidcup rail station': { name: 'Sidcup Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GSIDCUP' },
  'silver street rail station': { name: 'Silver Street Rail Station', zone: 4, modes: ['overground'], naptanId: '910GSIVRST' },
  'slade green rail station': { name: 'Slade Green Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GSLADEGN' },
  'sloane square underground station': { name: 'Sloane Square Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUSSQ' },
  'snaresbrook underground station': { name: 'Snaresbrook Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUSNB' },
  'south acton': { name: 'South Acton', zone: 3, modes: ['overground'], naptanId: '910GSACTON' },
  'south bermondsey rail station': { name: 'South Bermondsey Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GSBRMNDS' },
  'south croydon': { name: 'South Croydon', zone: 5, modes: ['national_rail'], naptanId: '910GSCROYDN' },
  'south ealing': { name: 'South Ealing', zone: 3, modes: ['underground'], naptanId: '940GZZLUSEA' },
  'south greenford rail station': { name: 'South Greenford Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GSGFORD' },
  'south hampstead rail station': { name: 'South Hampstead Rail Station', zone: 2, modes: ['overground'], naptanId: '910GSHMPSTD' },
  'south harrow underground station': { name: 'South Harrow Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUSHH' },
  'south kensington underground station': { name: 'South Kensington Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUSKS' },
  'south kenton': { name: 'South Kenton', zone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUSKT' },
  'south merton rail station': { name: 'South Merton Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GSMERTON' },
  'south quay dlr station': { name: 'South Quay DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLSOQ' },
  'south ruislip rail station': { name: 'South Ruislip Rail Station', zone: 5, modes: ['underground', 'national_rail'], naptanId: '910GSRUISLP' },
  'south ruislip underground station': { name: 'South Ruislip Underground Station', zone: 5, modes: ['underground', 'national_rail'], naptanId: '940GZZLUSRP' },
  'south tottenham rail station': { name: 'South Tottenham Rail Station', zone: 3, modes: ['overground'], naptanId: '910GSTOTNHM' },
  'south wimbledon underground station': { name: 'South Wimbledon Underground Station', zone: 3, altZone: 4, modes: ['underground'], naptanId: '940GZZLUSWN' },
  'south woodford': { name: 'South Woodford', zone: 4, modes: ['underground'], naptanId: '940GZZLUSWF' },
  'southall rail station': { name: 'Southall Rail Station', zone: 4, modes: ['national_rail', 'elizabeth'], naptanId: '910GSTHALL' },
  'southbury rail station': { name: 'Southbury Rail Station', zone: 5, modes: ['overground'], naptanId: '910GSBURY' },
  'southfields underground station': { name: 'Southfields Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUSFS' },
  'southgate underground station': { name: 'Southgate Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUSGT' },
  'southwark underground station': { name: 'Southwark Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUSWK' },
  'st helierrail station': { name: 'St Helier (London) Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GSHLIER' },
  'st james streetrail station': { name: 'St James Street (London) Rail Station', zone: 3, modes: ['overground'], naptanId: '910GSTJMSST' },
  'st james\'s park': { name: 'St James\'s Park', zone: 1, modes: ['underground'], naptanId: '940GZZLUSJP' },
  'st johns': { name: 'St Johns', zone: 2, modes: ['national_rail'], naptanId: '910GSTJOHNS' },
  'st margaretsrail station': { name: 'St Margarets (London) Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GSTMGTS' },
  'st mary cray rail station': { name: 'St Mary Cray Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GSTMRYC' },
  'st. john\'s wood underground station': { name: 'St. John\'s Wood Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUSJW' },
  'st. paul\'s underground station': { name: 'St. Paul\'s Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUSPU' },
  'stamford brook underground station': { name: 'Stamford Brook Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUSFB' },
  'stamford hill rail station': { name: 'Stamford Hill Rail Station', zone: 3, modes: ['overground'], naptanId: '910GSTMFDHL' },
  'stanmore underground station': { name: 'Stanmore Underground Station', zone: 5, modes: ['underground'], naptanId: '940GZZLUSTM' },
  'star lane dlr station': { name: 'Star Lane DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLSTL' },
  'stepney green underground station': { name: 'Stepney Green Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUSGN' },
  'stockwell underground station': { name: 'Stockwell Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUSKW' },
  'stoke newington rail station': { name: 'Stoke Newington Rail Station', zone: 2, modes: ['overground'], naptanId: '910GSTKNWNG' },
  'stonebridge park rail station': { name: 'Stonebridge Park Rail Station', zone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GSTNBGPK' },
  'stoneleigh': { name: 'Stoneleigh', zone: 5, modes: ['national_rail'], naptanId: '910GSTLEIGH' },
  'stratford dlr station': { name: 'Stratford DLR Station', zone: 2, altZone: 3, modes: ['dlr'], naptanId: '940GZZDLSTD' },
  'stratford high street dlr station': { name: 'Stratford High Street DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLSHS' },
  'stratford international dlr station': { name: 'Stratford International DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLSIT' },
  'stratford international rail station': { name: 'Stratford International Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GSTFODOM' },
  'stratford underground station': { name: 'Stratford Underground Station', zone: 2, altZone: 3, modes: ['elizabeth', 'national_rail', 'overground', 'underground'], naptanId: '940GZZLUSTD' },
  'stratfordrail station': { name: 'Stratford (London) Rail Station', zone: 2, altZone: 3, modes: ['elizabeth', 'national_rail', 'overground', 'underground'], naptanId: '910GSTFD' },
  'strawberry hill rail station': { name: 'Strawberry Hill Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GSTRWBYH' },
  'streatham common rail station': { name: 'Streatham Common Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GSTRHCOM' },
  'streatham hill rail station': { name: 'Streatham Hill Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GSTRHILL' },
  'streatham rail station': { name: 'Streatham Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GSTRETHM' },
  'sudbury & harrow road rail station': { name: 'Sudbury & Harrow Road Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GSDBRYHR' },
  'sudbury hill harrow rail station': { name: 'Sudbury Hill Harrow Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GSDBRYHH' },
  'sudbury hill underground station': { name: 'Sudbury Hill Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUSUH' },
  'sudbury town': { name: 'Sudbury Town', zone: 4, modes: ['underground'], naptanId: '940GZZLUSUT' },
  'sundridge park': { name: 'Sundridge Park', zone: 4, modes: ['national_rail'], naptanId: '910GSNDP' },
  'surbiton rail station': { name: 'Surbiton Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GSURBITN' },
  'surrey quays rail station': { name: 'Surrey Quays Rail Station', zone: 2, modes: ['overground'], naptanId: '910GSURREYQ' },
  'sutton common rail station': { name: 'Sutton Common Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GSUTTONC' },
  'suttonrail station': { name: 'Sutton (London) Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GSUTTON' },
  'swanley': { name: 'Swanley', zone: 8, modes: ['national_rail'], naptanId: '910GSWLY' },
  'swiss cottage': { name: 'Swiss Cottage', zone: 2, modes: ['underground'], naptanId: '940GZZLUSWC' },
  'sydenham hill rail station': { name: 'Sydenham Hill Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GSYDNHMH' },
  'sydenham rail station': { name: 'Sydenham Rail Station', zone: 3, modes: ['national_rail', 'overground'], naptanId: '910GSYDENHM' },
  'syon lane rail station': { name: 'Syon Lane Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GSYONLA' },
  'tadworth': { name: 'Tadworth', zone: 6, modes: ['national_rail'], naptanId: '910GTADWTH' },
  'tattenham corner': { name: 'Tattenham Corner', zone: 6, modes: ['national_rail'], naptanId: '910GTATNHMC' },
  'teddington rail station': { name: 'Teddington Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GTEDNGTN' },
  'temple underground station': { name: 'Temple Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUTMP' },
  'thames ditton': { name: 'Thames Ditton', zone: 6, modes: ['national_rail'], naptanId: '910GTDITTON' },
  'theydon bois': { name: 'Theydon Bois', zone: 6, modes: ['underground'], naptanId: '940GZZLUTHB' },
  'thornton heath': { name: 'Thornton Heath', zone: 4, modes: ['national_rail'], naptanId: '910GTHTH' },
  'tolworth rail station': { name: 'Tolworth Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GTOLWTH' },
  'tooting bec underground station': { name: 'Tooting Bec Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUTBC' },
  'tooting broadway underground station': { name: 'Tooting Broadway Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUTBY' },
  'tooting rail station': { name: 'Tooting Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GTOOTING' },
  'tottenham court road': { name: 'Tottenham Court Road', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '910GTOTCTRD' },
  'tottenham court road underground station': { name: 'Tottenham Court Road Underground Station', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'], naptanId: '940GZZLUTCR' },
  'tottenham hale rail station': { name: 'Tottenham Hale Rail Station', zone: 3, modes: ['underground', 'national_rail'], naptanId: '910GTTNHMHL' },
  'tottenham hale underground station': { name: 'Tottenham Hale Underground Station', zone: 3, modes: ['underground', 'national_rail'], naptanId: '940GZZLUTMH' },
  'totteridge & whetstone underground station': { name: 'Totteridge & Whetstone Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUTAW' },
  'tower gateway dlr station': { name: 'Tower Gateway DLR Station', zone: 1, modes: ['dlr'], naptanId: '940GZZDLTWG' },
  'tower hill underground station': { name: 'Tower Hill Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUTWH' },
  'tufnell park underground station': { name: 'Tufnell Park Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUTFP' },
  'tulse hill rail station': { name: 'Tulse Hill Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GTULSEH' },
  'turkey street rail station': { name: 'Turkey Street Rail Station', zone: 6, modes: ['overground'], naptanId: '910GTURKYST' },
  'turnham green underground station': { name: 'Turnham Green Underground Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUTNG' },
  'turnpike lane underground station': { name: 'Turnpike Lane Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUTPN' },
  'twickenham rail station': { name: 'Twickenham Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GTWCKNHM' },
  'upminster': { name: 'Upminster', zone: 6, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUUPM' },
  'upminster bridge underground station': { name: 'Upminster Bridge Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLUUPB' },
  'upney underground station': { name: 'Upney Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUUPY' },
  'upper holloway rail station': { name: 'Upper Holloway Rail Station', zone: 2, modes: ['overground'], naptanId: '910GUPRHLWY' },
  'upper warlingham': { name: 'Upper Warlingham', zone: 6, modes: ['national_rail'], naptanId: '910GUWRLNGH' },
  'upton park underground station': { name: 'Upton Park Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUUPK' },
  'uxbridge underground station': { name: 'Uxbridge Underground Station', zone: 6, modes: ['underground'], naptanId: '940GZZLUUXB' },
  'vauxhall rail station': { name: 'Vauxhall Rail Station', zone: 1, altZone: 2, modes: ['underground', 'national_rail'], naptanId: '910GVAUXHLW' },
  'vauxhall underground station': { name: 'Vauxhall Underground Station', zone: 1, altZone: 2, modes: ['underground', 'national_rail'], naptanId: '940GZZLUVXL' },
  'victoria underground station': { name: 'Victoria Underground Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '940GZZLUVIC' },
  'waddon': { name: 'Waddon', zone: 5, modes: ['national_rail'], naptanId: '910GWADDON' },
  'wallington rail station': { name: 'Wallington Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GWALNGTN' },
  'waltham cross': { name: 'Waltham Cross', zone: 7, modes: ['national_rail'], naptanId: '910GWALHAMX' },
  'walthamstow central rail station': { name: 'Walthamstow Central Rail Station', zone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GWLTWCEN' },
  'walthamstow queens road rail station': { name: 'Walthamstow Queens Road Rail Station', zone: 3, modes: ['overground'], naptanId: '910GWLTHQRD' },
  'wandsworth common rail station': { name: 'Wandsworth Common Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GWANDCMN' },
  'wandsworth road rail station': { name: 'Wandsworth Road Rail Station', zone: 2, modes: ['overground'], naptanId: '910GWNDSWRD' },
  'wandsworth town rail station': { name: 'Wandsworth Town Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GWDWTOWN' },
  'wanstead park rail station': { name: 'Wanstead Park Rail Station', zone: 3, modes: ['overground'], naptanId: '910GWNSTDPK' },
  'wanstead underground station': { name: 'Wanstead Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUWSD' },
  'wapping rail station': { name: 'Wapping Rail Station', zone: 2, modes: ['overground'], naptanId: '910GWAPPING' },
  'warren street underground station': { name: 'Warren Street Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUWRR' },
  'warwick avenue underground station': { name: 'Warwick Avenue Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUWKA' },
  'waterloo east': { name: 'Waterloo East', zone: 1, modes: ['national_rail'], naptanId: '910GWATLOOE' },
  'waterloo underground station': { name: 'Waterloo Underground Station', zone: 1, modes: ['underground', 'national_rail'], naptanId: '940GZZLUWLO' },
  'watford': { name: 'Watford', zone: 7, modes: ['underground'], naptanId: '940GZZLUWAF' },
  'welling rail station': { name: 'Welling Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GWELLING' },
  'wembley central rail station': { name: 'Wembley Central Rail Station', zone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GWMBYDC' },
  'wembley central underground station': { name: 'Wembley Central Underground Station', zone: 4, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUWYC' },
  'wembley park': { name: 'Wembley Park', zone: 4, modes: ['underground'], naptanId: '940GZZLUWYP' },
  'wembley stadium rail station': { name: 'Wembley Stadium Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GWEMBLSM' },
  'west acton': { name: 'West Acton', zone: 3, modes: ['underground'], naptanId: '940GZZLUWTA' },
  'west brompton rail station': { name: 'West Brompton Rail Station', zone: 2, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GWBRMPTN' },
  'west brompton underground station': { name: 'West Brompton Underground Station', zone: 2, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUWBN' },
  'west croydon rail station': { name: 'West Croydon Rail Station', zone: 5, modes: ['national_rail', 'overground'], naptanId: '910GWCROYDN' },
  'west drayton rail station': { name: 'West Drayton Rail Station', zone: 6, modes: ['national_rail', 'elizabeth'], naptanId: '910GWDRYTON' },
  'west dulwich': { name: 'West Dulwich', zone: 3, modes: ['national_rail'], naptanId: '910GWDULWCH' },
  'west ealing': { name: 'West Ealing', zone: 3, modes: ['national_rail', 'elizabeth'], naptanId: '910GWEALING' },
  'west finchley underground station': { name: 'West Finchley Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUWFN' },
  'west ham dlr station': { name: 'West Ham DLR Station', zone: 2, altZone: 3, modes: ['underground', 'national_rail'], naptanId: '940GZZDLWHM' },
  'west ham rail station': { name: 'West Ham Rail Station', zone: 2, altZone: 3, modes: ['underground', 'national_rail'], naptanId: '910GWHAMHL' },
  'west ham underground station': { name: 'West Ham Underground Station', zone: 2, altZone: 3, modes: ['underground', 'national_rail'], naptanId: '940GZZLUWHM' },
  'west hampstead rail station': { name: 'West Hampstead Rail Station', zone: 2, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GWHMDSTD' },
  'west hampstead thameslink rail station': { name: 'West Hampstead Thameslink Rail Station', zone: 2, modes: ['national_rail'], naptanId: '910GWHMPSTM' },
  'west hampstead underground station': { name: 'West Hampstead Underground Station', zone: 2, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUWHP' },
  'west harrow': { name: 'West Harrow', zone: 5, modes: ['underground'], naptanId: '940GZZLUWHW' },
  'west india quay dlr station': { name: 'West India Quay DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLWIQ' },
  'west kensington underground station': { name: 'West Kensington Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUWKN' },
  'west norwood rail station': { name: 'West Norwood Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GWNORWOD' },
  'west ruislip rail station': { name: 'West Ruislip Rail Station', zone: 6, modes: ['underground', 'national_rail'], naptanId: '910GWRUISLP' },
  'west ruislip underground station': { name: 'West Ruislip Underground Station', zone: 6, modes: ['underground', 'national_rail'], naptanId: '940GZZLUWRP' },
  'west silvertown dlr station': { name: 'West Silvertown DLR Station', zone: 3, modes: ['dlr'], naptanId: '940GZZDLWSV' },
  'west sutton rail station': { name: 'West Sutton Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GWSUTTON' },
  'west wickham rail station': { name: 'West Wickham Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GWWICKHM' },
  'westbourne park underground station': { name: 'Westbourne Park Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUWSP' },
  'westcombe park rail station': { name: 'Westcombe Park Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GWCOMBEP' },
  'westferry dlr station': { name: 'Westferry DLR Station', zone: 2, modes: ['dlr'], naptanId: '940GZZDLWFE' },
  'westminster underground station': { name: 'Westminster Underground Station', zone: 1, modes: ['underground'], naptanId: '940GZZLUWSM' },
  'white city underground station': { name: 'White City Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUWCY' },
  'white hart lane rail station': { name: 'White Hart Lane Rail Station', zone: 3, modes: ['overground'], naptanId: '910GWHHRTLA' },
  'whitechapel': { name: 'Whitechapel', zone: 2, modes: ['elizabeth', 'national_rail', 'overground', 'underground'], naptanId: '910GWCHAPXR' },
  'whitechapel rail station': { name: 'Whitechapel Rail Station', zone: 2, modes: ['elizabeth', 'national_rail', 'overground', 'underground'], naptanId: '910GWCHAPEL' },
  'whitechapel underground station': { name: 'Whitechapel Underground Station', zone: 2, modes: ['elizabeth', 'national_rail', 'overground', 'underground'], naptanId: '940GZZLUWPL' },
  'whitton rail station': { name: 'Whitton Rail Station', zone: 5, modes: ['national_rail'], naptanId: '910GWHTTON' },
  'whyteleafe': { name: 'Whyteleafe', zone: 6, modes: ['national_rail'], naptanId: '910GWHYTELF' },
  'whyteleafe south': { name: 'Whyteleafe South', zone: 6, modes: ['national_rail'], naptanId: '910GWHYTLFS' },
  'willesden green underground station': { name: 'Willesden Green Underground Station', zone: 2, altZone: 3, modes: ['underground'], naptanId: '940GZZLUWIG' },
  'willesden junction low level rail station': { name: 'Willesden Junction Low Level Rail Station', zone: 2, altZone: 3, modes: ['national_rail'], naptanId: '910GWLSDNJL' },
  'willesden junction rail station': { name: 'Willesden Junction Rail Station', zone: 2, altZone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '910GWLSDJHL' },
  'willesden junction underground station': { name: 'Willesden Junction Underground Station', zone: 2, altZone: 3, modes: ['national_rail', 'overground', 'underground'], naptanId: '940GZZLUWJN' },
  'wimbledon chase rail station': { name: 'Wimbledon Chase Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GWIMLCHS' },
  'wimbledon park underground station': { name: 'Wimbledon Park Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUWIP' },
  'wimbledon rail station': { name: 'Wimbledon Rail Station', zone: 3, modes: ['underground', 'national_rail'], naptanId: '910GWIMBLDN' },
  'wimbledon underground station': { name: 'Wimbledon Underground Station', zone: 3, modes: ['underground', 'national_rail'], naptanId: '940GZZLUWIM' },
  'winchmore hill rail station': { name: 'Winchmore Hill Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GWNMHILL' },
  'wood green underground station': { name: 'Wood Green Underground Station', zone: 3, modes: ['underground'], naptanId: '940GZZLUWOG' },
  'wood lane underground station': { name: 'Wood Lane Underground Station', zone: 2, modes: ['underground'], naptanId: '940GZZLUWLA' },
  'wood street': { name: 'Wood Street', zone: 4, modes: ['overground'], naptanId: '910GWDST' },
  'woodford underground station': { name: 'Woodford Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUWOF' },
  'woodgrange park rail station': { name: 'Woodgrange Park Rail Station', zone: 3, altZone: 4, modes: ['overground'], naptanId: '910GWDGRNPK' },
  'woodmansterne rail station': { name: 'Woodmansterne Rail Station', zone: 6, modes: ['national_rail'], naptanId: '910GWDMNSTR' },
  'woodside park underground station': { name: 'Woodside Park Underground Station', zone: 4, modes: ['underground'], naptanId: '940GZZLUWOP' },
  'woolwich': { name: 'Woolwich', zone: 4, modes: ['national_rail', 'elizabeth'], naptanId: '910GWOLWXR' },
  'woolwich arsenal dlr station': { name: 'Woolwich Arsenal DLR Station', zone: 4, modes: ['national_rail'], naptanId: '940GZZDLWLA' },
  'woolwich arsenal rail station': { name: 'Woolwich Arsenal Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GWOLWCHA' },
  'woolwich dockyard rail station': { name: 'Woolwich Dockyard Rail Station', zone: 3, modes: ['national_rail'], naptanId: '910GWOLWCDY' },
  'worcester park rail station': { name: 'Worcester Park Rail Station', zone: 4, modes: ['national_rail'], naptanId: '910GWRCSTRP' },
};

export function normalizeStationName(raw: string): string {
  return raw
    .replace(/\s*\[.*?\]\s*/g, '') // remove [National Rail], [London Underground], etc.
    .replace(/\s*\(platforms?\s*[\d\-]+\)\s*/gi, '') // remove (platforms 12-19)
    .replace(/\s*\(District,\s*Piccadilly lines?\)\s*/gi, '') // Hammersmith qualifier
    .trim()
    .toLowerCase();
}

// Get full station info object
export function getStationInfo(rawName: string): StationInfo | null {
  const normalized = normalizeStationName(rawName);

  // Direct lookup
  if (STATIONS[normalized]) {
    return STATIONS[normalized];
  }

  // try fallbacks if direct normalisation fails
  let key = normalized.replace(/\[.*?\]/g, '').trim();
  if (STATIONS[key]) return STATIONS[key];

  key = key.replace(/\(.*?\)/g, '').trim();
  if (STATIONS[key]) return STATIONS[key];

  for (const [k, info] of Object.entries(STATIONS)) {
    if (normalized.includes(k) || k.includes(normalized)) {
      return info;
    }
  }

  return null;
}

// Look up a station's zone from its name as it appears in the CSV
export function getStationZone(rawName: string): number | null {
  const info = getStationInfo(rawName);
  return info ? info.zone : null;
}

// Get the best zone for fare calculation (use alt zone if cheaper for passenger)
export function getStationBestZone(rawName: string, otherZone: number): number | null {
  const station = getStationInfo(rawName);
  if (!station) return null;

  // If station has an alt zone, pick the one closer to the other station's zone (cheaper fare)
  if (station.altZone !== undefined) {
    const distPrimary = Math.abs(station.zone - otherZone);
    const distAlt = Math.abs(station.altZone - otherZone);
    return distAlt < distPrimary ? station.altZone : station.zone;
  }

  return station.zone;
}

// Get transport mode from CSV Journey/Action string
export type TransportMode = 'underground' | 'national_rail' | 'overground' | 'bus' | 'tram' | 'dlr' | 'elizabeth' | 'nr_tube' | 'unknown';

export function detectTransportMode(journeyAction: string): TransportMode {
  const lower = journeyAction.toLowerCase();

  if (lower.includes('bus journey')) return 'bus';
  if (lower.includes('tram')) return 'tram';

  const hasNR = lower.includes('[national rail]');
  const hasLU = lower.includes('[london underground]') || (!hasNR && lower.includes(' to '));

  if (hasNR && hasLU && lower.includes(' to ')) return 'nr_tube';
  if (hasNR && lower.includes(' to ')) return 'national_rail';
  if (hasLU && lower.includes(' to ')) return 'underground';

  return 'unknown';
}

export interface StationSearchResult {
  key: string;
  info: StationInfo;
  matchScore: number;
}

const MODE_LABELS: Record<string, string> = {
  underground: 'Tube',
  national_rail: 'National Rail',
  overground: 'London Overground',
  dlr: 'DLR',
  elizabeth: 'Elizabeth line',
};

/**
 * Get human-readable mode labels for a station
 */
export function getModeBadges(modes: StationInfo['modes']): string[] {
  return modes.map(m => MODE_LABELS[m] || m);
}

/**
 * Format a zone display string (e.g., "Zone 2/3" for altZone stations)
 */
export function formatZoneDisplay(info: StationInfo): string {
  if (info.altZone !== undefined) {
    return `Zone ${info.zone}/${info.altZone}`;
  }
  return `Zone ${info.zone}`;
}

/**
 * Zone color palette — consistent across all dashboard views.
 * Maps zone numbers to HSL-tuned colors inspired by TfL zone map aesthetics.
 */
const ZONE_COLORS: Record<number, string> = {
  1: '#0ea5e9', // Sky Blue
  2: '#3b82f6', // Blue
  3: '#10b981', // Green
  4: '#f59e0b', // Amber
  5: '#f97316', // Orange
  6: '#8b5cf6', // Purple
  7: '#ec4899', // Pink
  8: '#ec4899', // Pink
  9: '#ec4899', // Pink
};

/**
 * Get the display color for a zone number or zone range string.
 * Accepts a single zone number (1-9), a zone range string like "Z1-3",
 * or undefined / unknown values (returns fallback).
 */
export function getZoneColor(zone: number | string | undefined): string {
  if (zone === undefined || zone === null) return 'var(--color-oyster-blue)';

  // If it's a number, direct lookup
  if (typeof zone === 'number') {
    return ZONE_COLORS[zone] || 'var(--color-oyster-blue)';
  }

  // If it's a string like "Z1-3", extract the max zone
  const match = zone.match(/(\d+)/g);
  if (match && match.length > 0) {
    const maxZone = Math.max(...match.map(Number));
    return ZONE_COLORS[maxZone] || 'var(--color-oyster-blue)';
  }

  return 'var(--color-oyster-blue)';
}

/**
 * Helper to normalize station names and queries for search by removing
 * apostrophes, replacing special punctuation with spaces, and collapsing whitespace.
 */
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .replace(/['’]/g, '') // remove apostrophes (king's -> kings)
    .replace(/[^a-z0-9]/g, ' ') // replace non-alphanumeric with spaces
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Search stations by name with fuzzy matching.
 * Returns up to `limit` results sorted by relevance.
 */
export function searchStations(query: string, limit: number = 10): StationSearchResult[] {
  if (!query || query.length < 1) return [];

  const q = query.toLowerCase().trim();
  const qNorm = normalizeForSearch(query);
  const hasNorm = qNorm.length > 0;
  const results: StationSearchResult[] = [];

  for (const [key, info] of Object.entries(STATIONS)) {
    const name = info.name.toLowerCase();
    const nameNorm = normalizeForSearch(info.name);
    const keyNorm = normalizeForSearch(key);
    let score = 0;

    // Direct exact matches (non-normalized and normalized)
    if (name === q) {
      score = 100;
    } else if (hasNorm && nameNorm === qNorm) {
      score = 95;
    } 
    // Starts-with matches
    else if (name.startsWith(q)) {
      score = 85 + (q.length / name.length) * 10;
    } else if (hasNorm && nameNorm.startsWith(qNorm)) {
      score = 80 + (qNorm.length / nameNorm.length) * 10;
    } else if (key.startsWith(q)) {
      score = 75 + (q.length / key.length) * 10;
    } else if (hasNorm && keyNorm.startsWith(qNorm)) {
      score = 70 + (qNorm.length / keyNorm.length) * 10;
    }
    // Word-starts-with matches (using normalized strings)
    else if (hasNorm && nameNorm.split(' ').some(word => word.startsWith(qNorm))) {
      score = 55 + (qNorm.length / nameNorm.length) * 10;
    } else if (name.split(/[\s\-&']+/).some(word => word.startsWith(q))) {
      score = 50 + (q.length / name.length) * 10;
    }
    // Includes matches
    else if (name.includes(q)) {
      score = 35 + (q.length / name.length) * 5;
    } else if (hasNorm && nameNorm.includes(qNorm)) {
      score = 30 + (qNorm.length / nameNorm.length) * 5;
    } else if (key.includes(q)) {
      score = 25 + (q.length / key.length) * 5;
    } else if (hasNorm && keyNorm.includes(qNorm)) {
      score = 20 + (qNorm.length / keyNorm.length) * 5;
    }

    if (score > 0) {
      results.push({ key, info, matchScore: score });
    }
  }

  results.sort((a, b) => b.matchScore !== a.matchScore ? b.matchScore - a.matchScore : a.info.name.localeCompare(b.info.name));
  return results.slice(0, limit);
}

/**
 * Get station info by NaPTAN ID (reverse lookup for API responses)
 */
export function getStationByNaptan(naptanId: string): { key: string; info: StationInfo } | null {
  for (const [key, info] of Object.entries(STATIONS)) {
    if (info.naptanId === naptanId) return { key, info };
  }
  return null;
}

/**
 * Get all stations as a sorted list (for full autocomplete dropdown)
 */
export function getAllStationsForSearch(): StationSearchResult[] {
  return Object.entries(STATIONS)
    .map(([key, info]) => ({ key, info, matchScore: 0 }))
    .sort((a, b) => a.info.name.localeCompare(b.info.name));
}
