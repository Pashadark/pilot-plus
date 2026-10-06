// White-background derivatives are tied to an exact car, never a model name.
export const promoPhotos=Object.freeze({
 'cmsw6ncun00entuq8p8wal42s':'/images/fleet-white/cmsw6ncun00entuq8p8wal42s.png',
 'cmsw6ncur00eptuq80ic13drz':'/images/fleet-white/cmsw6ncur00eptuq80ic13drz.png',
 'cmsw6ncuu00ertuq858hv20mj':'/images/fleet-white/cmsw6ncuu00ertuq858hv20mj.png',
 'cmswhnbr50001tup4ixahj9ee':'/images/fleet-white/cmswhnbr50001tup4ixahj9ee.png',
 'cmswho0c10001tu04p3q73aqw':'/images/fleet-white/cmswho0c10001tu04p3q73aqw.png',
 'cmswho0c70003tu04ygmg6gb3':'/images/fleet-white/cmswho0c70003tu04ygmg6gb3.png',
 'cmswho0cg0005tu04kjypsv1j':'/images/fleet-white/cmswho0cg0005tu04kjypsv1j.png',
 'cmswho0cl0007tu04f1zm6eka':'/images/fleet-white/cmswho0cl0007tu04f1zm6eka.png',
 'cmt1x5x200001tu4wkn0n2q4n':'/images/fleet-white/cmt1x5x200001tu4wkn0n2q4n.png',
 'cmtdfthvu0005tujseopdlh4e':'/images/fleet-white/cmtdfthvu0005tujseopdlh4e.png',
 'cmtdfthw3000dtujs3eyq7p71':'/images/fleet-white/cmtdfthw3000dtujs3eyq7p71.png',
 'cmtdgxote000ttu18133knumk':'/images/fleet-white/cmtdgxote000ttu18133knumk.png',
 'cmu6nohbq0001e7adgf3u3vb1':'/images/fleet-white/cmu6nohbq0001e7adgf3u3vb1.png',
});
export const illustrativePhotos=Object.freeze({
 'cmu6nojfg000fe7dh9d8zareg':'/images/fleet-white/camry-black-illustration.png',
 'cmtdfthvk0001tujsj7n5tnd9':'/images/fleet-white/karoq-gray-illustration.png',
 '632a53d1-5480-4f92-85ea-02518b5038f6':'/images/fleet-white/k5-white-illustration.png',
 'cmswho0cq0009tu0458y1j14h':'/images/fleet-white/octavia-white-illustration.png',
});
export function vehiclePhotoSources(car){
 if(!car.image) return illustrativePhotos[car.id] ? [illustrativePhotos[car.id]] : [];
 return [...new Set([promoPhotos[car.id],car.image].filter(Boolean))];
}
