'use client';
import {TbGasStation,TbManualGearbox,TbEngine,TbArmchair,TbX,TbArrowsMove} from 'react-icons/tb';
export function CarSpecs({car}) {
 const items=[[TbManualGearbox,car.transmission],[TbEngine,car.engine],[TbGasStation,car.fuel],[TbArmchair,car.seats ? `${car.seats} мест`:null]].filter(([,text])=>text && !text.startsWith('Не указан'));
 return <div className="catalog-specs">{items.map(([Icon,text],i)=><span key={i}><Icon aria-hidden="true"/>{text}</span>)}</div>;
}
export default function CatalogControls({cars,filters,onChange}) {
 const brands=[...new Set(cars.map(c=>c.group))];
 const models=[...new Set(cars.filter(c=>c.group===filters.make).map(c=>c.name))];
 const active=Boolean(filters.make || filters.model || filters.fuel || filters.drive);
 return <div className="catalog-controls">
  <div className="catalog-selects">
   <label><select aria-label="Марка автомобиля" value={filters.make} onChange={e=>onChange({...filters,make:e.target.value,model:''})}><option value="">Все марки</option>{brands.map(b=><option key={b}>{b}</option>)}</select></label>
   <label><select aria-label="Модель автомобиля" disabled={!filters.make} value={filters.model} onChange={e=>onChange({...filters,model:e.target.value})}><option value="">Все модели</option>{models.map(m=><option key={m}>{m}</option>)}</select></label>
  </div>
  <div className="catalog-chips" role="group" aria-label="Топливо"><TbGasStation aria-hidden="true"/>{['Бензин','Гибрид','Дизель','Электро'].filter(f=>f!=='Электро'||cars.some(c=>c.fuel===f)).map(f=><button key={f} type="button" aria-pressed={filters.fuel===f} onClick={()=>onChange({...filters,fuel:filters.fuel===f?'':f})}>{f}</button>)}</div>
  <div className="catalog-chips" role="group" aria-label="Привод"><TbArrowsMove aria-hidden="true"/>{['Передний','Задний','4WD'].map(d=><button key={d} type="button" title={cars.some(c=>c.drive===d)?undefined:'Данные о приводе уточняются'} disabled={!cars.some(c=>c.drive===d)} aria-pressed={filters.drive===d} onClick={()=>onChange({...filters,drive:filters.drive===d?'':d})}>{d}</button>)}</div>
  <button className="catalog-reset" type="button" disabled={!active} onClick={()=>onChange({make:'',model:'',fuel:'',drive:''})}><TbX aria-hidden="true"/>Сбросить</button>
 </div>;
}
