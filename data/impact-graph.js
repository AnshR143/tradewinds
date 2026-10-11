export const SCENARIOS = [
  {
    id: 'us-hurricane',
    short: 'US hurricane',
    label: 'Hurricane or tropical storm hitting the US Gulf or Atlantic coast',
    links: [
      {
        id: 'home-repair', direction: 'tailwind', confidence: 'likely', horizon: 'weeks',
        chain: ['Storm damages homes', 'People buy repair supplies', 'Home-repair stores sell more'],
        wrongIf: 'The storm weakens before landfall and damage is light.',
        companies: [{ name: 'Home Depot', ticker: 'HD' }, { name: "Lowe's", ticker: 'LOW' }],
      },
      {
        id: 'backup-power', direction: 'tailwind', confidence: 'likely', horizon: 'weeks',
        chain: ['Storm knocks out power', 'People want backup power', 'Generator maker sells more'],
        wrongIf: 'Power comes back within a day or two.',
        companies: [{ name: 'Generac', ticker: 'GNRC' }],
      },
      {
        id: 'insurers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Storm damages homes and cars', 'Owners file insurance claims', 'Insurers pay out more'],
        wrongIf: 'Most damage is flooding, which standard home insurance usually does not cover.',
        companies: [{ name: 'Allstate', ticker: 'ALL' }, { name: 'Travelers', ticker: 'TRV' }, { name: 'SPDR Insurance fund', ticker: 'KIE', type: 'fund' }],
      },
      {
        id: 'power-companies', direction: 'headwind', confidence: 'likely', horizon: 'weeks',
        chain: ['Storm tears down power lines', 'Power company pays for repairs', 'Its costs jump'],
        wrongIf: 'Regulators let the company pass repair costs on to customers quickly.',
        companies: [{ name: 'NextEra Energy (Florida)', ticker: 'NEE' }, { name: 'Southern Company (Georgia, Alabama)', ticker: 'SO' }, { name: 'Entergy (Louisiana, Texas)', ticker: 'ETR' }],
      },
      {
        id: 'cruises', direction: 'headwind', confidence: 'likely', horizon: 'days',
        chain: ['Ports close for the storm', 'Sailings are cancelled or rerouted', 'Cruise lines refund trips'],
        wrongIf: 'Ships simply reroute and few trips are cancelled.',
        companies: [{ name: 'Carnival', ticker: 'CCL' }, { name: 'Royal Caribbean', ticker: 'RCL' }],
      },
      {
        id: 'refineries', direction: 'headwind', confidence: 'guess', horizon: 'days',
        chain: ['Storm nears Texas or Louisiana', 'Fuel plants shut down for safety', 'They lose days of output'],
        wrongIf: 'The storm misses the Texas and Louisiana coast, where most fuel plants are.',
        companies: [{ name: 'Valero', ticker: 'VLO' }, { name: 'Marathon Petroleum', ticker: 'MPC' }],
      },
    ],
  },
  {
    id: 'mexico-pacific-hurricane',
    short: 'Mexico hurricane',
    label: 'Hurricane near Mexico\'s Pacific coast',
    links: [
      {
        id: 'airports', direction: 'headwind', confidence: 'likely', horizon: 'weeks',
        chain: ['Storm closes resorts and airports', 'Fewer travelers fly in', 'Airport operator earns less'],
        wrongIf: 'The storm stays offshore and airports stay open.',
        companies: [{ name: 'Grupo Aeroportuario del Pacífico', ticker: 'PAC' }],
      },
      {
        id: 'cruises', direction: 'headwind', confidence: 'likely', horizon: 'days',
        chain: ['Ports close for the storm', 'Sailings are cancelled or rerouted', 'Cruise lines refund trips'],
        wrongIf: 'Ships simply reroute and few trips are cancelled.',
        companies: [{ name: 'Carnival', ticker: 'CCL' }, { name: 'Norwegian Cruise Line', ticker: 'NCLH' }],
      },
      {
        id: 'cargo-rail', direction: 'headwind', confidence: 'guess', horizon: 'weeks',
        chain: ['Storm closes Mexico\'s Pacific ports', 'Cargo headed to the US is delayed', 'The railroad carries less'],
        wrongIf: 'The ports reopen within a few days.',
        companies: [{ name: 'Canadian Pacific Kansas City', ticker: 'CP' }],
      },
      {
        id: 'rebuilding', direction: 'tailwind', confidence: 'guess', horizon: 'months',
        chain: ['Storm damages buildings and roads in Mexico', 'Rebuilding begins', 'Mexico\'s biggest cement maker sells more'],
        wrongIf: 'The storm stays offshore, or damage is light.',
        companies: [{ name: 'Cemex', ticker: 'CX' }],
      },
    ],
  },
  {
    id: 'asia-typhoon',
    short: 'East Asia typhoon',
    label: 'Typhoon near East Asia (Taiwan, Japan, Korea, China, Philippines)',
    links: [
      {
        id: 'chips', direction: 'headwind', confidence: 'guess', horizon: 'weeks',
        chain: ['Storm hits a chip-making region', 'Factories and ports pause', 'Chip shipments arrive late'],
        wrongIf: 'The storm stays at sea or misses the factory regions.',
        companies: [{ name: 'Taiwan Semiconductor', ticker: 'TSM' }, { name: 'VanEck Semiconductor fund', ticker: 'SMH', type: 'fund' }],
      },
      {
        id: 'shipping', direction: 'tailwind', confidence: 'guess', horizon: 'weeks',
        chain: ['Ports close for the storm', 'Ships wait and schedules slip', 'Shipping prices rise'],
        wrongIf: 'Ports reopen quickly and the backlog clears.',
        companies: [{ name: 'Matson', ticker: 'MATX' }, { name: 'Danaos', ticker: 'DAC' }],
      },
    ],
  },
  {
    id: 'winter-storm',
    short: 'US winter storm',
    label: 'Major winter storm, blizzard or ice storm in the US',
    links: [
      {
        id: 'airlines', direction: 'headwind', confidence: 'strong', horizon: 'days',
        chain: ['Snow and ice close runways', 'Flights are cancelled', 'Airlines lose ticket sales'],
        wrongIf: 'The storm misses the big hub airports.',
        companies: [{ name: 'Delta Air Lines', ticker: 'DAL' }, { name: 'United Airlines', ticker: 'UAL' }, { name: 'US Global Jets fund', ticker: 'JETS', type: 'fund' }],
      },
      {
        id: 'heating-gas', direction: 'tailwind', confidence: 'likely', horizon: 'weeks',
        chain: ['Cold snap hits', 'Homes burn more natural gas', 'Gas producers earn more'],
        wrongIf: 'The cold lasts only a day or two.',
        companies: [{ name: 'EQT', ticker: 'EQT' }],
      },
      {
        id: 'backup-power', direction: 'tailwind', confidence: 'likely', horizon: 'weeks',
        chain: ['Ice brings down power lines', 'People want backup power', 'Generator maker sells more'],
        wrongIf: 'Power stays on.',
        companies: [{ name: 'Generac', ticker: 'GNRC' }],
      },
    ],
  },
  {
    id: 'inland-flood',
    short: 'US flooding',
    label: 'Major flooding in the US',
    links: [
      {
        id: 'railroads', direction: 'headwind', confidence: 'likely', horizon: 'weeks',
        chain: ['Water covers tracks and bridges', 'Freight trains are delayed', 'Railroads carry less'],
        wrongIf: 'The flooding is away from main rail lines.',
        companies: [{ name: 'Union Pacific', ticker: 'UNP' }, { name: 'CSX', ticker: 'CSX' }],
      },
      {
        id: 'home-repair', direction: 'tailwind', confidence: 'likely', horizon: 'weeks',
        chain: ['Water damages homes', 'People buy repair supplies', 'Home-repair stores sell more'],
        wrongIf: 'Few homes are in the flooded area.',
        companies: [{ name: 'Home Depot', ticker: 'HD' }, { name: "Lowe's", ticker: 'LOW' }],
      },
      {
        id: 'crops', direction: 'tailwind', confidence: 'guess', horizon: 'months',
        chain: ['Fields flood', 'Planting or harvest is delayed', 'Crop prices rise'],
        wrongIf: 'The flooding is outside farm country or outside the growing season.',
        companies: [{ name: 'Invesco Agriculture fund', ticker: 'DBA', type: 'fund' }],
      },
    ],
  },
  {
    id: 'western-wildfire',
    short: 'Western wildfire',
    label: 'Large wildfire in the western US',
    links: [
      {
        id: 'power-companies', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Fire starts near power lines', 'Power company may be blamed', 'It faces large payouts'],
        wrongIf: 'The fire is far from the company\'s territory or was not started by power lines.',
        companies: [{ name: 'PG&E (northern California)', ticker: 'PCG' }, { name: 'Edison International (southern California)', ticker: 'EIX' }],
      },
      {
        id: 'insurers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Fire burns homes', 'Owners file insurance claims', 'Insurers pay out more'],
        wrongIf: 'The fire burns mostly wild land with few homes.',
        companies: [{ name: 'Allstate', ticker: 'ALL' }, { name: 'Travelers', ticker: 'TRV' }],
      },
      {
        id: 'timber', direction: 'tailwind', confidence: 'guess', horizon: 'months',
        chain: ['Fire burns forest', 'Less wood is available', 'Wood prices rise for other owners'],
        wrongIf: 'The burned area is small compared to total timberland.',
        companies: [{ name: 'Weyerhaeuser', ticker: 'WY' }],
      },
    ],
  },
  {
    id: 'earthquake',
    short: 'Earthquake',
    label: 'Major earthquake',
    links: [
      {
        id: 'disaster-insurers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Quake destroys buildings', 'Claims reach the insurers\' insurers', 'They pay out more'],
        wrongIf: 'Few damaged buildings were insured, which is common outside rich countries.',
        companies: [{ name: 'RenaissanceRe', ticker: 'RNR' }, { name: 'Everest Group', ticker: 'EG' }],
      },
      {
        id: 'rebuilding', direction: 'tailwind', confidence: 'likely', horizon: 'months',
        chain: ['Quake destroys buildings and roads', 'Rebuilding begins', 'Cement and machine makers sell more'],
        wrongIf: 'Rebuilding is slow or paid for with little money.',
        companies: [{ name: 'Cemex (Latin America)', ticker: 'CX' }, { name: 'Caterpillar', ticker: 'CAT' }],
      },
      {
        id: 'chips', direction: 'headwind', confidence: 'likely', horizon: 'weeks',
        chain: ['Quake shakes Taiwan or Japan', 'Chip factories stop to check machines', 'Chip shipments arrive late'],
        wrongIf: 'The quake is not near Taiwan or Japan.',
        companies: [{ name: 'Taiwan Semiconductor', ticker: 'TSM' }, { name: 'VanEck Semiconductor fund', ticker: 'SMH', type: 'fund' }],
      },
      {
        id: 'canal-shipping', direction: 'tailwind', confidence: 'guess', horizon: 'weeks',
        chain: ['Quake strikes near a canal or big port', 'Ships wait for safety checks', 'Shipping prices rise'],
        wrongIf: 'The canal or port keeps running normally.',
        companies: [{ name: 'Matson', ticker: 'MATX' }, { name: 'Danaos', ticker: 'DAC' }],
      },
    ],
  },
  {
    id: 'volcano-ash',
    short: 'Volcanic ash',
    label: 'Volcanic eruption sending ash into flight paths',
    links: [
      {
        id: 'airlines', direction: 'headwind', confidence: 'likely', horizon: 'days',
        chain: ['Ash cloud drifts into flight paths', 'Flights are grounded', 'Airlines lose ticket sales'],
        wrongIf: 'The ash stays low or away from busy routes.',
        companies: [{ name: 'Delta Air Lines', ticker: 'DAL' }, { name: 'United Airlines', ticker: 'UAL' }, { name: 'US Global Jets fund', ticker: 'JETS', type: 'fund' }],
      },
    ],
  },
  {
    id: 'crop-weather',
    short: 'Crop weather',
    label: 'Drought, heat wave or freeze in a farming region',
    links: [
      {
        id: 'crop-prices', direction: 'tailwind', confidence: 'likely', horizon: 'months',
        chain: ['Bad weather ruins crops', 'Less food is harvested', 'Crop prices rise'],
        wrongIf: 'Other regions grow enough to make up the difference.',
        companies: [{ name: 'Invesco Agriculture fund', ticker: 'DBA', type: 'fund' }],
      },
      {
        id: 'fertilizer', direction: 'tailwind', confidence: 'guess', horizon: 'months',
        chain: ['Crop prices rise', 'Farmers plant more next season', 'Fertilizer makers sell more'],
        wrongIf: 'Crop prices fall back before planting season.',
        companies: [{ name: 'Nutrien', ticker: 'NTR' }, { name: 'CF Industries', ticker: 'CF' }],
      },
      {
        id: 'food-makers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Crop prices rise', 'Grain and feed cost more', 'Food makers earn less per item'],
        wrongIf: 'They raise prices in stores and shoppers keep buying.',
        companies: [{ name: 'General Mills', ticker: 'GIS' }, { name: 'Tyson Foods', ticker: 'TSN' }],
      },
    ],
  },
  {
    id: 'gold-up',
    short: 'Gold price up',
    label: 'Gold price rising worldwide',
    links: [
      {
        id: 'miners', direction: 'tailwind', confidence: 'strong', horizon: 'weeks',
        chain: ['Gold price rises', 'Mining costs stay about the same', 'Gold miners earn more per ounce'],
        wrongIf: 'The gold price falls back.',
        companies: [{ name: 'Newmont', ticker: 'NEM' }, { name: 'Agnico Eagle Mines', ticker: 'AEM' }],
      },
      {
        id: 'gold-fund', direction: 'tailwind', confidence: 'strong', horizon: 'weeks',
        chain: ['Gold price rises', 'The fund holds gold bars', 'The fund is worth more'],
        wrongIf: 'The gold price falls back.',
        companies: [{ name: 'SPDR Gold fund', ticker: 'GLD', type: 'fund' }],
      },
      {
        id: 'jewelers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Gold price rises', 'Jewelry costs more to make', 'Jewelers earn less or sell less'],
        wrongIf: 'Shoppers keep buying at the higher prices.',
        companies: [{ name: 'Signet Jewelers', ticker: 'SIG' }],
      },
    ],
  },
  {
    id: 'steel-up',
    short: 'Steel price up',
    label: 'Steel price rising, or new taxes on imported steel',
    links: [
      {
        id: 'steelmakers', direction: 'tailwind', confidence: 'strong', horizon: 'weeks',
        chain: ['Steel price rises', 'Steelmakers charge more per ton', 'Steelmakers earn more'],
        wrongIf: 'Their own costs, like scrap metal and energy, rise just as fast.',
        companies: [{ name: 'Nucor', ticker: 'NUE' }, { name: 'Steel Dynamics', ticker: 'STLD' }, { name: 'Cleveland-Cliffs', ticker: 'CLF' }],
      },
      {
        id: 'carmakers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Steel price rises', 'Each car costs more to build', 'Carmakers earn less per car'],
        wrongIf: 'They have already locked in steel at old prices.',
        companies: [{ name: 'Ford', ticker: 'F' }, { name: 'General Motors', ticker: 'GM' }],
      },
      {
        id: 'appliances', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Steel price rises', 'Washers and fridges cost more to build', 'Appliance makers earn less'],
        wrongIf: 'They raise prices and shoppers keep buying.',
        companies: [{ name: 'Whirlpool', ticker: 'WHR' }],
      },
    ],
  },
  {
    id: 'oil-up',
    short: 'Oil price up',
    label: 'Oil or fuel price rising',
    links: [
      {
        id: 'oil-producers', direction: 'tailwind', confidence: 'strong', horizon: 'weeks',
        chain: ['Oil price rises', 'Each barrel sells for more', 'Oil producers earn more'],
        wrongIf: 'The price jump lasts only a few days.',
        companies: [{ name: 'ExxonMobil', ticker: 'XOM' }, { name: 'Chevron', ticker: 'CVX' }, { name: 'Energy Select fund', ticker: 'XLE', type: 'fund' }],
      },
      {
        id: 'airlines', direction: 'headwind', confidence: 'strong', horizon: 'weeks',
        chain: ['Oil price rises', 'Jet fuel costs more', 'Airlines earn less per flight'],
        wrongIf: 'Airlines raise ticket prices enough to cover it.',
        companies: [{ name: 'Delta Air Lines', ticker: 'DAL' }, { name: 'United Airlines', ticker: 'UAL' }, { name: 'US Global Jets fund', ticker: 'JETS', type: 'fund' }],
      },
      {
        id: 'delivery', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Fuel price rises', 'Trucks and planes cost more to run', 'Delivery companies earn less'],
        wrongIf: 'They add fuel fees that customers accept.',
        companies: [{ name: 'FedEx', ticker: 'FDX' }, { name: 'UPS', ticker: 'UPS' }],
      },
      {
        id: 'cruises', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Fuel price rises', 'Ships cost more to run', 'Cruise lines earn less per trip'],
        wrongIf: 'They bought their fuel in advance at old prices.',
        companies: [{ name: 'Carnival', ticker: 'CCL' }],
      },
    ],
  },
  {
    id: 'gas-up',
    short: 'Natural gas up',
    label: 'Natural gas price rising',
    links: [
      {
        id: 'gas-producers', direction: 'tailwind', confidence: 'strong', horizon: 'weeks',
        chain: ['Natural gas price rises', 'Each unit sells for more', 'Gas producers earn more'],
        wrongIf: 'The price jump lasts only a few days.',
        companies: [{ name: 'EQT', ticker: 'EQT' }],
      },
      {
        id: 'fertilizer-makers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Natural gas price rises', 'Fertilizer costs more to make', 'Fertilizer makers earn less'],
        wrongIf: 'Fertilizer prices rise by as much as gas does.',
        companies: [{ name: 'CF Industries', ticker: 'CF' }],
      },
    ],
  },
  {
    id: 'egg-shortage',
    short: 'Egg shortage',
    label: 'Egg prices rising or bird flu in poultry',
    links: [
      {
        id: 'egg-producers', direction: 'tailwind', confidence: 'strong', horizon: 'weeks',
        chain: ['Bird flu cuts the number of hens', 'Egg prices jump', 'Producers with healthy flocks earn more'],
        wrongIf: 'Their own farms get infected.',
        companies: [{ name: 'Cal-Maine Foods', ticker: 'CALM' }, { name: 'Vital Farms', ticker: 'VITL' }],
      },
      {
        id: 'breakfast-restaurants', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Egg prices jump', 'Breakfast costs more to serve', 'Restaurants earn less per meal'],
        wrongIf: 'They add a fee for eggs and diners accept it.',
        companies: [{ name: 'Dine Brands (IHOP)', ticker: 'DIN' }, { name: 'Cracker Barrel', ticker: 'CBRL' }],
      },
    ],
  },
  {
    id: 'coffee-up',
    short: 'Coffee price up',
    label: 'Coffee price rising',
    links: [
      {
        id: 'coffee-sellers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Coffee bean price rises', 'Each cup costs more to make', 'Coffee chains earn less per cup'],
        wrongIf: 'They raise menu prices and customers keep coming.',
        companies: [{ name: 'Starbucks', ticker: 'SBUX' }],
      },
    ],
  },
  {
    id: 'cocoa-up',
    short: 'Cocoa price up',
    label: 'Cocoa or chocolate price rising',
    links: [
      {
        id: 'chocolate-makers', direction: 'headwind', confidence: 'strong', horizon: 'months',
        chain: ['Cocoa price rises', 'Chocolate costs more to make', 'Chocolate makers earn less'],
        wrongIf: 'They raise prices or shrink bars and shoppers keep buying.',
        companies: [{ name: 'Hershey', ticker: 'HSY' }, { name: 'Mondelez', ticker: 'MDLZ' }],
      },
    ],
  },
  {
    id: 'chip-shortage',
    short: 'Chip shortage',
    label: 'Shortage of computer chips',
    links: [
      {
        id: 'chip-makers', direction: 'tailwind', confidence: 'likely', horizon: 'months',
        chain: ['Chips are in short supply', 'Buyers pay more to get them', 'Chip makers earn more'],
        wrongIf: 'The shortage is caused by their own factories being shut.',
        companies: [{ name: 'Taiwan Semiconductor', ticker: 'TSM' }, { name: 'VanEck Semiconductor fund', ticker: 'SMH', type: 'fund' }],
      },
      {
        id: 'carmakers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Chips are in short supply', 'Cars cannot be finished', 'Carmakers sell fewer cars'],
        wrongIf: 'They stocked up on chips beforehand.',
        companies: [{ name: 'Ford', ticker: 'F' }, { name: 'General Motors', ticker: 'GM' }],
      },
    ],
  },
  {
    id: 'shipping-blocked',
    short: 'Shipping blocked',
    label: 'Shipping route blocked or attacked, or a port strike',
    links: [
      {
        id: 'ship-owners', direction: 'tailwind', confidence: 'likely', horizon: 'weeks',
        chain: ['A sea route or port is blocked', 'Ships take longer trips or wait', 'Shipping prices rise'],
        wrongIf: 'The route reopens within days.',
        companies: [{ name: 'Matson', ticker: 'MATX' }, { name: 'Danaos', ticker: 'DAC' }],
      },
      {
        id: 'air-freight', direction: 'tailwind', confidence: 'guess', horizon: 'weeks',
        chain: ['Sea cargo is stuck', 'Urgent goods switch to planes', 'Air cargo carriers earn more'],
        wrongIf: 'Most of the stuck cargo is too heavy or cheap to fly.',
        companies: [{ name: 'FedEx', ticker: 'FDX' }, { name: 'UPS', ticker: 'UPS' }],
      },
      {
        id: 'retailers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Sea cargo is stuck', 'Goods arrive late and cost more to ship', 'Stores earn less'],
        wrongIf: 'Stores already have plenty of stock on hand.',
        companies: [{ name: 'Target', ticker: 'TGT' }, { name: 'Nike', ticker: 'NKE' }],
      },
      {
        id: 'oil-route', direction: 'tailwind', confidence: 'likely', horizon: 'weeks',
        chain: ['An oil shipping route is threatened', 'Oil price rises on the risk', 'Oil producers elsewhere earn more'],
        wrongIf: 'The route is not one that oil tankers use.',
        companies: [{ name: 'ExxonMobil', ticker: 'XOM' }, { name: 'Chevron', ticker: 'CVX' }],
      },
    ],
  },
  {
    id: 'disease-outbreak',
    short: 'Disease outbreak',
    label: 'Disease outbreak spreading between people',
    links: [
      {
        id: 'travel', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Outbreak spreads', 'People cancel trips', 'Airlines and cruise lines sell fewer tickets'],
        wrongIf: 'The outbreak stays in one small area.',
        companies: [{ name: 'Delta Air Lines', ticker: 'DAL' }, { name: 'Carnival', ticker: 'CCL' }, { name: 'US Global Jets fund', ticker: 'JETS', type: 'fund' }],
      },
      {
        id: 'hotels', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Outbreak spreads', 'People cancel trips', 'Hotels fill fewer rooms'],
        wrongIf: 'The outbreak stays in one small area.',
        companies: [{ name: 'Marriott', ticker: 'MAR' }, { name: 'Hilton', ticker: 'HLT' }],
      },
      {
        id: 'vaccine-makers', direction: 'tailwind', confidence: 'guess', horizon: 'months',
        chain: ['Outbreak spreads', 'Governments order vaccines and tests', 'Drug makers sell more'],
        wrongIf: 'No vaccine exists for this disease, or the outbreak ends quickly.',
        companies: [{ name: 'Pfizer', ticker: 'PFE' }, { name: 'Moderna', ticker: 'MRNA' }],
      },
    ],
  },
  {
    id: 'armed-conflict',
    short: 'Armed conflict',
    label: 'War or armed conflict escalating',
    links: [
      {
        id: 'defense', direction: 'tailwind', confidence: 'likely', horizon: 'months',
        chain: ['Conflict grows', 'Governments order more weapons', 'Defense companies sell more'],
        wrongIf: 'The countries involved do not buy from US defense companies.',
        companies: [{ name: 'Lockheed Martin', ticker: 'LMT' }, { name: 'RTX', ticker: 'RTX' }, { name: 'iShares Aerospace and Defense fund', ticker: 'ITA', type: 'fund' }],
      },
      {
        id: 'oil', direction: 'tailwind', confidence: 'likely', horizon: 'weeks',
        chain: ['Conflict threatens an oil region', 'Oil price rises on the risk', 'Oil producers elsewhere earn more'],
        wrongIf: 'The conflict is far from oil fields and tanker routes.',
        companies: [{ name: 'ExxonMobil', ticker: 'XOM' }, { name: 'Energy Select fund', ticker: 'XLE', type: 'fund' }],
      },
      {
        id: 'airlines', direction: 'headwind', confidence: 'guess', horizon: 'weeks',
        chain: ['Airspace closes over the conflict', 'Planes fly longer routes', 'Airlines burn more fuel'],
        wrongIf: 'Few major flight routes cross the area.',
        companies: [{ name: 'United Airlines', ticker: 'UAL' }, { name: 'Delta Air Lines', ticker: 'DAL' }],
      },
    ],
  },
  {
    id: 'import-taxes',
    short: 'Import taxes',
    label: 'New taxes on imported goods (tariffs)',
    links: [
      {
        id: 'importers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Imported goods are taxed', 'Stores pay more for what they sell', 'Stores earn less or raise prices'],
        wrongIf: 'The tax does not cover the countries they buy from.',
        companies: [{ name: 'Target', ticker: 'TGT' }, { name: 'Nike', ticker: 'NKE' }],
      },
      {
        id: 'local-steel', direction: 'tailwind', confidence: 'likely', horizon: 'months',
        chain: ['Imported steel is taxed', 'Buyers switch to US steel', 'US steelmakers sell more'],
        wrongIf: 'The tax does not cover steel.',
        companies: [{ name: 'Nucor', ticker: 'NUE' }, { name: 'Steel Dynamics', ticker: 'STLD' }],
      },
      {
        id: 'carmakers', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Imported parts are taxed', 'Each car costs more to build', 'Carmakers earn less per car'],
        wrongIf: 'The tax does not cover car parts.',
        companies: [{ name: 'Ford', ticker: 'F' }, { name: 'General Motors', ticker: 'GM' }],
      },
    ],
  },
  {
    id: 'rates-up',
    short: 'Interest rates up',
    label: 'Interest rates rising (borrowing costs more)',
    links: [
      {
        id: 'homebuilders', direction: 'headwind', confidence: 'likely', horizon: 'months',
        chain: ['Borrowing costs rise', 'Home loans cost more', 'Fewer people buy new homes'],
        wrongIf: 'Rates rise only a little or home demand stays strong.',
        companies: [{ name: 'D.R. Horton', ticker: 'DHI' }, { name: 'Lennar', ticker: 'LEN' }, { name: 'SPDR Homebuilders fund', ticker: 'XHB', type: 'fund' }],
      },
      {
        id: 'banks', direction: 'tailwind', confidence: 'guess', horizon: 'months',
        chain: ['Borrowing costs rise', 'Banks charge more on loans', 'Banks earn more per loan'],
        wrongIf: 'Fewer people borrow, or more people fail to pay loans back.',
        companies: [{ name: 'JPMorgan Chase', ticker: 'JPM' }, { name: 'Bank of America', ticker: 'BAC' }],
      },
    ],
  },
  {
    id: 'cyberattack',
    short: 'Cyberattack',
    label: 'Large cyberattack or computer outage',
    links: [
      {
        id: 'security-companies', direction: 'tailwind', confidence: 'likely', horizon: 'months',
        chain: ['A big attack makes the news', 'Companies spend more on protection', 'Security companies sell more'],
        wrongIf: 'The outage was caused by a security company\'s own mistake.',
        companies: [{ name: 'Palo Alto Networks', ticker: 'PANW' }, { name: 'CrowdStrike', ticker: 'CRWD' }],
      },
    ],
  },

  {
    id: 'conflict-eases',
    short: 'Conflict eases',
    label: 'War or armed conflict easing (a ceasefire or peace deal holds)',
    links: [
      {
        id: 'oil', direction: 'headwind', confidence: 'likely', horizon: 'weeks',
        chain: ['The threat to an oil region fades', 'Oil price falls as the risk drops', 'Oil producers earn less per barrel'],
        wrongIf: 'The conflict was far from oil fields and tanker routes.',
        companies: [{ name: 'ExxonMobil', ticker: 'XOM' }, { name: 'Energy Select fund', ticker: 'XLE', type: 'fund' }],
      },
      {
        id: 'defense', direction: 'headwind', confidence: 'guess', horizon: 'months',
        chain: ['Fighting stops', 'Governments feel less need to order weapons', 'Defense companies sell less'],
        wrongIf: 'Governments keep restocking their weapons anyway.',
        companies: [{ name: 'Lockheed Martin', ticker: 'LMT' }, { name: 'RTX', ticker: 'RTX' }, { name: 'iShares Aerospace and Defense fund', ticker: 'ITA', type: 'fund' }],
      },
      {
        id: 'airlines', direction: 'tailwind', confidence: 'guess', horizon: 'weeks',
        chain: ['Airspace reopens and fuel gets cheaper', 'Flights cost less to run', 'Airlines earn more per flight'],
        wrongIf: 'Few major flight routes crossed the area, or oil stays expensive.',
        companies: [{ name: 'United Airlines', ticker: 'UAL' }, { name: 'Delta Air Lines', ticker: 'DAL' }],
      },
    ],
  },
  {
    id: 'oil-down',
    short: 'Oil price down',
    label: 'Oil or fuel price falling',
    links: [
      {
        id: 'airlines', direction: 'tailwind', confidence: 'strong', horizon: 'weeks',
        chain: ['Oil price falls', 'Jet fuel costs less', 'Airlines earn more per flight'],
        wrongIf: 'Airlines cut ticket prices by as much as they save.',
        companies: [{ name: 'Delta Air Lines', ticker: 'DAL' }, { name: 'United Airlines', ticker: 'UAL' }, { name: 'US Global Jets fund', ticker: 'JETS', type: 'fund' }],
      },
      {
        id: 'delivery', direction: 'tailwind', confidence: 'likely', horizon: 'months',
        chain: ['Fuel price falls', 'Trucks and planes cost less to run', 'Delivery companies earn more'],
        wrongIf: 'They lower their fuel fees by the same amount.',
        companies: [{ name: 'FedEx', ticker: 'FDX' }, { name: 'UPS', ticker: 'UPS' }],
      },
      {
        id: 'cruises', direction: 'tailwind', confidence: 'likely', horizon: 'months',
        chain: ['Fuel price falls', 'Ships cost less to run', 'Cruise lines earn more per trip'],
        wrongIf: 'They bought their fuel in advance at old prices.',
        companies: [{ name: 'Carnival', ticker: 'CCL' }],
      },
      {
        id: 'oil-producers', direction: 'headwind', confidence: 'strong', horizon: 'weeks',
        chain: ['Oil price falls', 'Each barrel sells for less', 'Oil producers earn less'],
        wrongIf: 'The price drop lasts only a few days.',
        companies: [{ name: 'ExxonMobil', ticker: 'XOM' }, { name: 'Chevron', ticker: 'CVX' }, { name: 'Energy Select fund', ticker: 'XLE', type: 'fund' }],
      },
    ],
  },
  {
    id: 'rates-down',
    short: 'Interest rates down',
    label: 'Interest rates falling (borrowing costs less)',
    links: [
      {
        id: 'homebuilders', direction: 'tailwind', confidence: 'likely', horizon: 'months',
        chain: ['Borrowing costs fall', 'Home loans cost less', 'More people buy new homes'],
        wrongIf: 'Rates fall only a little, or people fear losing their jobs.',
        companies: [{ name: 'D.R. Horton', ticker: 'DHI' }, { name: 'Lennar', ticker: 'LEN' }, { name: 'SPDR Homebuilders fund', ticker: 'XHB', type: 'fund' }],
      },
      {
        id: 'banks', direction: 'headwind', confidence: 'guess', horizon: 'months',
        chain: ['Borrowing costs fall', 'Banks charge less on loans', 'Banks earn less per loan'],
        wrongIf: 'More people borrow, which makes up for it.',
        companies: [{ name: 'JPMorgan Chase', ticker: 'JPM' }, { name: 'Bank of America', ticker: 'BAC' }],
      },
    ],
  },
];

export const LINKS = new Map(
  SCENARIOS.flatMap((scenario) => scenario.links.map((link) => [`${scenario.id}/${link.id}`, { ...link, scenario }])),
);

export function scenarioLabel(id) {
  return SCENARIOS.find((s) => s.id === id)?.label || null;
}
