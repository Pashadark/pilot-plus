export function filterCars(cars,{make='',model='',fuel='',drive='',onlyFree=false}={}) {
 return cars.filter(c=>(!make || c.group===make) && (!model || c.name===model) && (!fuel || c.fuel===fuel) && (!drive || c.drive===drive) && (!onlyFree || c.available));
}
