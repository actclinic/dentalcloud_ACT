// Myanmar Cities and States/Regions Data
// Source: https://github.com/bilions-org/myanmar-cities

export interface MyanmarCity {
  name: string;
  stateRegion: string;
}

export const myanmarStatesAndRegions: string[] = [
  'Kachin State',
  'Kayah State',
  'Kayin State',
  'Chin State',
  'Sagaing Region',
  'Tanintharyi Region',
  'Bago Region',
  'Magway Region',
  'Mandalay Region',
  'Mon State',
  'Rakhine State',
  'Yangon Region',
  'Shan State',
  'Ayeyarwady Region',
  'Naypyidaw Union Territory'
];

export const myanmarCities: MyanmarCity[] = [
  // Yangon Region
  { name: 'Yangon', stateRegion: 'Yangon Region' },
  { name: 'Thanlyin', stateRegion: 'Yangon Region' },
  { name: 'Insein', stateRegion: 'Yangon Region' },
  { name: 'Taikkyi', stateRegion: 'Yangon Region' },
  { name: 'Hmawbi', stateRegion: 'Yangon Region' },
  { name: 'Hlegu', stateRegion: 'Yangon Region' },
  { name: 'Kyauktan', stateRegion: 'Yangon Region' },
  { name: 'Twante', stateRegion: 'Yangon Region' },
  { name: 'Kawhmu', stateRegion: 'Yangon Region' },
  { name: 'Kayan', stateRegion: 'Yangon Region' },
  { name: 'Dala', stateRegion: 'Yangon Region' },
  { name: 'Seikgyi Kanaungto', stateRegion: 'Yangon Region' },
  { name: 'Cocokyun', stateRegion: 'Yangon Region' },
  
  // Mandalay Region
  { name: 'Mandalay', stateRegion: 'Mandalay Region' },
  { name: 'Pyin Oo Lwin', stateRegion: 'Mandalay Region' },
  { name: 'Myingyan', stateRegion: 'Mandalay Region' },
  { name: 'Kyaukse', stateRegion: 'Mandalay Region' },
  { name: 'Meiktila', stateRegion: 'Mandalay Region' },
  { name: 'Nyaung U', stateRegion: 'Mandalay Region' },
  { name: 'Yamethin', stateRegion: 'Mandalay Region' },
  { name: 'Madaya', stateRegion: 'Mandalay Region' },
  { name: 'Mogok', stateRegion: 'Mandalay Region' },
  { name: 'Singu', stateRegion: 'Mandalay Region' },
  { name: 'Myittha', stateRegion: 'Mandalay Region' },
  { name: 'Wundwin', stateRegion: 'Mandalay Region' },
  { name: 'Mahlaing', stateRegion: 'Mandalay Region' },
  { name: 'Tada-U', stateRegion: 'Mandalay Region' },
  { name: 'Patheingyi', stateRegion: 'Mandalay Region' },
  { name: 'Aungmyethazan', stateRegion: 'Mandalay Region' },
  
  // Sagaing Region
  { name: 'Sagaing', stateRegion: 'Sagaing Region' },
  { name: 'Monywa', stateRegion: 'Sagaing Region' },
  { name: 'Shwebo', stateRegion: 'Sagaing Region' },
  { name: 'Kanbalu', stateRegion: 'Sagaing Region' },
  { name: 'Katha', stateRegion: 'Sagaing Region' },
  { name: 'Indaw', stateRegion: 'Sagaing Region' },
  { name: 'Mawlaik', stateRegion: 'Sagaing Region' },
  { name: 'Kalay', stateRegion: 'Sagaing Region' },
  { name: 'Tamu', stateRegion: 'Sagaing Region' },
  { name: 'Kalewa', stateRegion: 'Sagaing Region' },
  { name: 'Khamti', stateRegion: 'Sagaing Region' },
  { name: 'Homalin', stateRegion: 'Sagaing Region' },
  
  // Bago Region
  { name: 'Bago', stateRegion: 'Bago Region' },
  { name: 'Pyay', stateRegion: 'Bago Region' },
  { name: 'Taungoo', stateRegion: 'Bago Region' },
  { name: 'Tharyarwady', stateRegion: 'Bago Region' },
  { name: 'Letpadan', stateRegion: 'Bago Region' },
  { name: 'Okpho', stateRegion: 'Bago Region' },
  { name: 'Waw', stateRegion: 'Bago Region' },
  { name: 'Kyauktaga', stateRegion: 'Bago Region' },
  { name: 'Daik-U', stateRegion: 'Bago Region' },
  { name: 'Shwegyin', stateRegion: 'Bago Region' },
  { name: 'Phyu', stateRegion: 'Bago Region' },
  
  // Ayeyarwady Region
  { name: 'Pathein', stateRegion: 'Ayeyarwady Region' },
  { name: 'Hinthada', stateRegion: 'Ayeyarwady Region' },
  { name: 'Myaungmya', stateRegion: 'Ayeyarwady Region' },
  { name: 'Maubin', stateRegion: 'Ayeyarwady Region' },
  { name: 'Kyonpyaw', stateRegion: 'Ayeyarwady Region' },
  { name: 'Bogale', stateRegion: 'Ayeyarwady Region' },
  { name: 'Lemyethna', stateRegion: 'Ayeyarwady Region' },
  { name: 'Kangyidaunt', stateRegion: 'Ayeyarwady Region' },
  { name: 'Myanaung', stateRegion: 'Ayeyarwady Region' },
  { name: 'Ingapu', stateRegion: 'Ayeyarwady Region' },
  { name: 'Einme', stateRegion: 'Ayeyarwady Region' },
  { name: 'Wakema', stateRegion: 'Ayeyarwady Region' },
  
  // Magway Region
  { name: 'Magway', stateRegion: 'Magway Region' },
  { name: 'Pakokku', stateRegion: 'Magway Region' },
  { name: 'Minbu', stateRegion: 'Magway Region' },
  { name: 'Thayet', stateRegion: 'Magway Region' },
  { name: 'Gangaw', stateRegion: 'Magway Region' },
  { name: 'Chauk', stateRegion: 'Magway Region' },
  { name: 'Natmauk', stateRegion: 'Magway Region' },
  { name: 'Myothit', stateRegion: 'Magway Region' },
  { name: 'Salin', stateRegion: 'Magway Region' },
  { name: 'Mindon', stateRegion: 'Magway Region' },
  { name: 'Tayet', stateRegion: 'Magway Region' },
  
  // Tanintharyi Region
  { name: 'Dawei', stateRegion: 'Tanintharyi Region' },
  { name: 'Myeik', stateRegion: 'Tanintharyi Region' },
  { name: 'Kawthaung', stateRegion: 'Tanintharyi Region' },
  { name: 'Tanintharyi', stateRegion: 'Tanintharyi Region' },
  { name: 'Kyunsu', stateRegion: 'Tanintharyi Region' },
  { name: 'Palaw', stateRegion: 'Tanintharyi Region' },
  { name: 'Yebyu', stateRegion: 'Tanintharyi Region' },
  { name: 'Launglon', stateRegion: 'Tanintharyi Region' },
  
  // Mon State
  { name: 'Mawlamyine', stateRegion: 'Mon State' },
  { name: 'Thaton', stateRegion: 'Mon State' },
  { name: 'Ye', stateRegion: 'Mon State' },
  { name: 'Kyaikmaraw', stateRegion: 'Mon State' },
  { name: 'Mudon', stateRegion: 'Mon State' },
  { name: 'Chaungzon', stateRegion: 'Mon State' },
  { name: 'Bilin', stateRegion: 'Mon State' },
  
  // Kayin State
  { name: 'Hpa-An', stateRegion: 'Kayin State' },
  { name: 'Myawaddy', stateRegion: 'Kayin State' },
  { name: 'Kawkareik', stateRegion: 'Kayin State' },
  { name: 'Hpapun', stateRegion: 'Kayin State' },
  
  // Kayah State
  { name: 'Loikaw', stateRegion: 'Kayah State' },
  { name: 'Demoso', stateRegion: 'Kayah State' },
  { name: 'Bawlakhe', stateRegion: 'Kayah State' },
  { name: 'Mese', stateRegion: 'Kayah State' },
  
  // Shan State
  { name: 'Taunggyi', stateRegion: 'Shan State' },
  { name: 'Lashio', stateRegion: 'Shan State' },
  { name: 'Muse', stateRegion: 'Shan State' },
  { name: 'Kengtung', stateRegion: 'Shan State' },
  { name: 'Tachileik', stateRegion: 'Shan State' },
  { name: 'Hsipaw', stateRegion: 'Shan State' },
  { name: 'Kyaukme', stateRegion: 'Shan State' },
  { name: 'Langkho', stateRegion: 'Shan State' },
  { name: 'Kunlong', stateRegion: 'Shan State' },
  { name: 'Mong Hsat', stateRegion: 'Shan State' },
  { name: 'Mong Hpayak', stateRegion: 'Shan State' },
  
  // Kachin State
  { name: 'Myitkyina', stateRegion: 'Kachin State' },
  { name: 'Bhamo', stateRegion: 'Kachin State' },
  { name: 'Mohnyin', stateRegion: 'Kachin State' },
  { name: 'Moguang', stateRegion: 'Kachin State' },
  { name: 'Putao', stateRegion: 'Kachin State' },
  { name: 'Waingmaw', stateRegion: 'Kachin State' },
  
  // Chin State
  { name: 'Hakha', stateRegion: 'Chin State' },
  { name: 'Falam', stateRegion: 'Chin State' },
  { name: 'Matupi', stateRegion: 'Chin State' },
  { name: 'Mindat', stateRegion: 'Chin State' },
  
  // Rakhine State
  { name: 'Sittwe', stateRegion: 'Rakhine State' },
  { name: 'Kyaukpyu', stateRegion: 'Rakhine State' },
  { name: 'Mrauk-U', stateRegion: 'Rakhine State' },
  { name: 'Thandwe', stateRegion: 'Rakhine State' },
  { name: 'Maungdaw', stateRegion: 'Rakhine State' },
  { name: 'Buthidaung', stateRegion: 'Rakhine State' },
  { name: 'Rathedaung', stateRegion: 'Rakhine State' },
  { name: 'Pauktaw', stateRegion: 'Rakhine State' },
  
  // Naypyidaw
  { name: 'Naypyidaw', stateRegion: 'Naypyidaw Union Territory' }
];

// Get unique cities sorted alphabetically
export const getMyanmarCities = (): string[] => {
  return [...new Set(myanmarCities.map(city => city.name))].sort();
};

// Get cities by state/region
export const getCitiesByStateRegion = (stateRegion: string): string[] => {
  return myanmarCities
    .filter(city => city.stateRegion === stateRegion)
    .map(city => city.name)
    .sort();
};

// Get state/region for a city
export const getStateRegionForCity = (city: string): string | undefined => {
  const found = myanmarCities.find(c => c.name === city);
  return found?.stateRegion;
};

// Get all cities as options for dropdown
export const getCityOptions = (): { value: string; label: string; stateRegion: string }[] => {
  return myanmarCities
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(city => ({
      value: city.name,
      label: city.name,
      stateRegion: city.stateRegion
    }));
};
