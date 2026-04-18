// Myanmar Cities/Regions and their townships

export interface MyanmarCity {
  name: string;
  township: string;
}

const cityTownshipsMap: Record<string, string[]> = {
  Yangon: ['Yangon', 'Thanlyin', 'Insein', 'Taikkyi', 'Hmawbi', 'Hlegu', 'Kyauktan', 'Twante', 'Kawhmu', 'Kayan', 'Dala', 'Seikgyi Kanaungto', 'Cocokyun'],
  Mandalay: ['Mandalay', 'Pyin Oo Lwin', 'Myingyan', 'Kyaukse', 'Meiktila', 'Nyaung U', 'Yamethin', 'Madaya', 'Mogok', 'Singu', 'Myittha', 'Wundwin', 'Mahlaing', 'Tada-U', 'Patheingyi', 'Aungmyethazan'],
  Sagaing: ['Sagaing', 'Monywa', 'Shwebo', 'Kanbalu', 'Katha', 'Indaw', 'Mawlaik', 'Kalay', 'Tamu', 'Kalewa', 'Khamti', 'Homalin'],
  Bago: ['Bago', 'Pyay', 'Taungoo', 'Tharyarwady', 'Letpadan', 'Okpho', 'Waw', 'Kyauktaga', 'Daik-U', 'Shwegyin', 'Phyu'],
  Ayeyarwady: ['Pathein', 'Hinthada', 'Myaungmya', 'Maubin', 'Kyonpyaw', 'Bogale', 'Lemyethna', 'Kangyidaunt', 'Myanaung', 'Ingapu', 'Einme', 'Wakema'],
  Magway: ['Magway', 'Pakokku', 'Minbu', 'Thayet', 'Gangaw', 'Chauk', 'Natmauk', 'Myothit', 'Salin', 'Mindon', 'Tayet'],
  Tanintharyi: ['Dawei', 'Myeik', 'Kawthaung', 'Tanintharyi', 'Kyunsu', 'Palaw', 'Yebyu', 'Launglon'],
  Mon: ['Mawlamyine', 'Thaton', 'Ye', 'Kyaikmaraw', 'Mudon', 'Chaungzon', 'Bilin'],
  Kayin: ['Hpa-An', 'Myawaddy', 'Kawkareik', 'Hpapun'],
  Kayah: ['Loikaw', 'Demoso', 'Bawlakhe', 'Mese'],
  Shan: ['Taunggyi', 'Lashio', 'Muse', 'Kengtung', 'Tachileik', 'Hsipaw', 'Kyaukme', 'Langkho', 'Kunlong', 'Mong Hsat', 'Mong Hpayak'],
  Kachin: ['Myitkyina', 'Bhamo', 'Mohnyin', 'Moguang', 'Putao', 'Waingmaw'],
  Chin: ['Hakha', 'Falam', 'Matupi', 'Mindat'],
  Rakhine: ['Sittwe', 'Kyaukpyu', 'Mrauk-U', 'Thandwe', 'Maungdaw', 'Buthidaung', 'Rathedaung', 'Pauktaw'],
  Naypyidaw: ['Naypyidaw']
};

const uniqueSorted = (items: string[]) => [...new Set(items)].sort((a, b) => a.localeCompare(b));

export const myanmarCities: MyanmarCity[] = Object.entries(cityTownshipsMap).flatMap(([city, townships]) =>
  townships.map((township) => ({ name: city, township }))
);

// Backward-compatible all-townships list (used in older UI paths).
export const myanmarTownships: string[] = uniqueSorted(
  Object.values(cityTownshipsMap).flatMap((townships) => townships)
);

export const getMyanmarCities = (): string[] => uniqueSorted(Object.keys(cityTownshipsMap));

export const getTownshipsForCity = (city: string): string[] => {
  if (!city) return [];
  return cityTownshipsMap[city] ? [...cityTownshipsMap[city]] : [];
};

// Backward-compatible helper.
export const getTownshipForCity = (city: string): string | undefined => {
  const townships = getTownshipsForCity(city);
  return townships.length > 0 ? townships[0] : undefined;
};

export const getCityOptions = (): { value: string; label: string; township: string }[] => {
  return getMyanmarCities().map((city) => ({
    value: city,
    label: city,
    township: getTownshipForCity(city) || ''
  }));
};

