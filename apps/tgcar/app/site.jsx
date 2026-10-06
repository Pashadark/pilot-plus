'use client';
import { useState } from 'react';
import {SiBmw,SiKia,SiSkoda,SiToyota,SiVolkswagen} from 'react-icons/si';
import {TbBrandMercedes,TbCalendarEvent,TbClipboardCheck,TbKey} from 'react-icons/tb';
import SiteHeader from './site-header';
import Dialog from './dialog';
import { quote } from '../quote.mjs';
import ClientForm from './client-form';
import {StorageSettingsButton} from './storage-notice';
import { useFleet } from './use-fleet';
import {vehiclePhotoSources} from '../vehicle-promo.mjs';
import {illustrativePhotos} from '../vehicle-promo.mjs';
import {filterCars} from '../catalog-filter.mjs';
import CatalogControls,{CarSpecs} from './catalog-controls';
import {SocialButtons,PaymentMarks} from './footer-extras';
import JournalContent from './journal-content';
import {posts} from './blog/posts.mjs';
import AboutContent from './about-content';
import AboutSections from './about-sections';
import YandexReviews from './yandex-reviews';
const money = (n) => n == null ? 'Уточняется' : new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
const brandMarks={BMW:SiBmw,Kia:SiKia,'Mercedes-Benz':TbBrandMercedes,Skoda:SiSkoda,Toyota:SiToyota,Volkswagen:SiVolkswagen};
function BrandMark({brand}) {const Icon=brandMarks[brand];return Icon ? <Icon className="brand-mark" aria-hidden="true" focusable="false"/> : null;}
function CarPhoto({car}) {
 const [index,setIndex]=useState(0);
 const sources=vehiclePhotoSources(car);
 return sources[index] ? <img src={sources[index]} alt={car.name} onError={()=>setIndex(i=>i+1)} loading="lazy"/> : <div className="photo-empty">{car.name}<small>Фотография скоро появится</small></div>;
}
function CarGallery({car}) {
 const [original,setOriginal]=useState(false);
 const sources=vehiclePhotoSources(car);
 return <><div className="detail-photo">{original ? <img src={car.image} alt={car.name}/> : <CarPhoto car={car}/>}</div>{sources.length>1 && <div className="photo-tabs" aria-label="Фотографии автомобиля"><button className={!original?'selected':''} aria-pressed={!original} onClick={()=>setOriginal(false)}>Промофото</button><button className={original?'selected':''} aria-pressed={original} onClick={()=>setOriginal(true)}>Оригинал фото</button></div>}</>;
}
function Pin() {
  return <span aria-hidden="true">⌖</span>;
}
export default function Site({about=false,aboutSection='company'}) {
  const [category, setCategory] = useState('Все автомобили'),
    [catalogFilters,setCatalogFilters]=useState({make:'',model:'',fuel:'',drive:''}),
    [selectedCar, setSelected] = useState(null),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [booking, setBooking] = useState(false),
    [article, setArticle] = useState(null),
    [startTime,setStartTime]=useState('10:00'),
    [endTime,setEndTime]=useState('10:00'),
    [onlyFree,setOnlyFree]=useState(true);
  const {cars,checkedAt,error,loading,refresh}=useFleet(start,end,startTime,endTime);
  const selected=selectedCar ? (cars.find(c=>c.id===selectedCar.id) || {...selectedCar,available:false}) : null;
  const groups=['Все автомобили',...new Set(cars.map(c=>c.group))];
  const visibleCars=filterCars(cars,{...catalogFilters,make:category==='Все автомобили'?'':category,onlyFree});
  function changeFilters(next){setCatalogFilters(next);setCategory(next.make || 'Все автомобили');}
  const total=selected ? quote(start,end,selected.rate,startTime,endTime) : null;
  const canBook=Boolean(total && selected?.available && !error && !loading);
  function open(car) {
    setSelected(car);
    setBooking(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function close() {
    setSelected(null);
    setBooking(false);
  }
  function dates() {
    return (
      <>
        <label>
          Начало аренды
          <input
            aria-label="Начало аренды"
            type="date"
            value={start}
            onChange={(e) => {setStart(e.target.value);setBooking(false);}}
            required
          />
          <input aria-label="Время получения (Москва)" type="time" value={startTime} onChange={e=>{setStartTime(e.target.value);setBooking(false);}}/>
        </label>
        <label>
          Возврат автомобиля
          <input
            aria-label="Возврат автомобиля"
            type="date"
            min={start || undefined}
            value={end}
            onChange={(e) => {setEnd(e.target.value);setBooking(false);}}
            required
          />
          <input aria-label="Время возврата (Москва)" type="time" value={endTime} onChange={e=>{setEndTime(e.target.value);setBooking(false);}}/>
        </label>
      </>
    );
  }
  return (
    <>
      <SiteHeader onHome={close} about={about}/>
      <main>
        {about ? <AboutSections section={aboutSection}><AboutContent/></AboutSections> : !selected ? (
          <>
            <section className="hero">
              <img src="/images/hero-redesign.png" alt="Toyota Camry на московской набережной" fetchPriority="high" />
              <div className="hero-copy">
                <div className="eyebrow">МОСКВА И МОСКОВСКАЯ ОБЛАСТЬ</div>
                <h1>
                  Ваш автомобиль.
                  <br />
                  <em>Ваш ритм.</em>
                </h1>
                <p>
                  Аренда автомобилей в Москве и области
                </p>
              </div>
            </section>
            <div className="wrap">
              <form
                className="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  document.getElementById('fleet').scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <label>
                  <span>
                    <Pin /> Офис получения
                  </span>
                  <strong>Москва, Зелёный проспект, 22</strong>
                  <small>Ежедневно, 10:00–20:00</small>
                </label>
                {dates()}
                <button className="button">Найти автомобиль</button>
              </form>
              <div className="categories">
                {groups.map((c) => (
                  <button
                    key={c}
                    className={category === c ? 'category active' : 'category'}
                    aria-pressed={category === c}
                    onClick={() => {
                      setCategory(c);
                      setCatalogFilters(f=>({...f,make:c==='Все автомобили'?'':c,model:''}));
                      document.getElementById('fleet').scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <BrandMark brand={c}/>
                    <span>{c}</span>
                    {c!=='Все автомобили' && <small>{cars.filter(car=>car.group===c).length} авто</small>}
                  </button>
                ))}
              </div>
              <section id="fleet" className="section">
                <div className="section-title">
                  <div className="eyebrow">ДЛЯ ГОРОДА И ВАШИХ ПЛАНОВ</div>
                  <h2>Выберите свой автомобиль</h2>
                  <p>Выберите даты и время — покажем свободные машины. Время московское.</p>
                </div>
                <label className="free-filter"><input type="checkbox" role="switch" checked={onlyFree} onChange={e=>setOnlyFree(e.target.checked)}/><span className="switch-track" aria-hidden="true"><span className="switch-handle"/></span><span>Только свободные {start && end ? 'на выбранные даты' : 'сейчас'}</span></label>
                <CatalogControls cars={cars} filters={catalogFilters} onChange={changeFilters}/>
                <div className="filter">
                  <span>
                    {error || loading ? 'Проверка…' : `${visibleCars.length} из ${cars.length} авто`}
                  </span>
                </div>
                <div className="fleet-sync" aria-live="polite">
                  <span>{loading ? 'Проверяем доступность…' : error || `Проверено ${new Date(checkedAt).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow'})} · ${start && end ? 'на выбранный период' : 'сейчас'}`}</span>
                  <button className="outline" onClick={refresh} disabled={loading}>Обновить</button>
                </div>
                {loading && !cars.length && <div className="car-grid" aria-label="Загрузка автопарка">{[1,2,3].map(n=><div key={n} className="fleet-skeleton"/>)}</div>}
                {!loading && !error && !visibleCars.length && <div className="fleet-empty">По выбранным условиям автомобили не найдены. Измените фильтры{onlyFree ? ' или отключите «Только свободные»' : ''}.</div>}
                <div className="car-grid" aria-busy={loading}>
                  {(error ? [] : visibleCars)
                    .map((car) => (
                      <article className="car" key={car.id}>
                        <button
                          className="car-image"
                          onClick={() => open(car)}
                          aria-label={'Подробнее о ' + car.name}
                        >
                          <CarPhoto key={car.id} car={car}/>
                          <span className={`availability-badge photo-availability ${loading ? 'pending' : car.available ? 'free' : 'busy'}`} role="status">{loading ? 'Проверяем доступность…' : car.label}</span>
                        </button>
                        <div className="car-body">
                          <div className="car-top">
                            <h3>{car.name}</h3>
                            <span>{car.year || 'Год уточняется'}</span>
                          </div>
                          <span className="office-tag"><Pin /> {car.office}</span>
                          {!car.image && illustrativePhotos[car.id] && <small className="illustration-note">Иллюстрация модели</small>}
                          <CarSpecs car={car}/>
                          <div className="price">
                            {car.rate && <span className="price-from">от</span>}{money(car.rate)} {car.rate && <small>/ сутки</small>}
                          </div>
                          <div className="car-actions">
                            <button className="outline" onClick={() => open(car)}>
                              Подробнее
                            </button>
                            <button className="button" onClick={() => open(car)}>
                              Выбрать даты
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
              </section>
              <section id="how" className="steps">
                <div>
                  <div className="eyebrow">ВСЁ ПРОСТО</div>
                  <h2>Аренда без лишних хлопот</h2>
                </div>
                {[
                  [
                    '01',
                    'Выберите автомобиль',
                    'Посмотрите характеристики, офис выдачи и условия.',
                  ],
                  ['02', 'Оставьте заявку', 'Укажите даты и контакты — менеджер подтвердит условия.'],
                  ['03', 'Заберите ключи', 'Встретим вас в офисе на Зелёном проспекте, 22.'],
                ].map(([n, t, d]) => (
                  <div key={n} className="rental-step">
                    <span className="step-icon" aria-hidden="true">{Number(n)}</span>
                    <div><h3>{t}</h3><p>{d}</p></div>
                  </div>
                ))}
              </section>
              <YandexReviews/>
              <section id="journal" className="section">
                <div className="section-title">
                  <div className="eyebrow">ПОЛЕЗНО ПЕРЕД ПОЕЗДКОЙ</div>
                  <h2>Блог</h2>
                  <p>Про автомобили, поездки и удобную аренду.</p>
                  <a href="/blog">Все статьи →</a>
                </div>
                <div className="news-grid">
                  {[
                    [
                      'hero',
                      'Ваш старт в Москве',
                      'Где забрать автомобиль и как спланировать визит в офис.',
                    ],
                    [
                      'camry',
                      'Как выбрать автомобиль',
                      'Комфорт для города, деловой встречи и поездки за город.',
                    ],
                    [
                      'bmw',
                      'Перед получением ключей',
                      'Что уточнить перед поездкой и проверить при выдаче.',
                    ],
                  ].map(([pic, title, desc], i) => (
                    <a className="news" key={title} href={`/blog/${posts[i].slug}`}>
                      <img src={'/images/' + pic + '.png'} alt="" />
                      <div>
                        <small>ГИД ПО АРЕНДЕ · {i + 2} МИН</small>
                        <h3>
                          {title} <span>↗</span>
                        </h3>
                        <p>{desc}</p>
                        <span className="read-story">Читать статью →</span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
              <section className="moscow" hidden>
                <img src="/images/hero.png" alt="Москва-Сити" />
                <div>
                  <div className="eyebrow">ГОРОД В ВАШЕМ РИТМЕ</div>
                  <h2>
                    Москва ближе,
                    <br />
                    когда вы за рулём
                  </h2>
                  <p>
                    Деловые встречи, выходные за городом или привычный маршрут — выбирайте
                    автомобиль под свои планы.
                  </p>
                  <p>
                    Наш офис находится на Зелёном проспекте, 22. Работаем каждый день, включая
                    субботу и воскресенье.
                  </p>
                  <a href="#contacts">Посмотреть адрес офиса ↗</a>
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="wrap detail">
            <button className="back" onClick={close}>
              ← Назад в автопарк
            </button>
            <div className="detail-heading">
              <div>
                <div className="eyebrow">
                  {selected.group} · {selected.year}
                </div>
                <h1>{selected.name}</h1>
                <p>
                  <Pin /> Москва, Зелёный проспект, 22
                </p>
              </div>
              <span className="pill">Ежедневно 10:00–20:00</span>
            </div>
            <div className="detail-grid">
              <div>
                <CarGallery key={selected.id} car={selected}/>
                {!selected.image && illustrativePhotos[selected.id] && <small className="illustration-note">Иллюстрация модели. Комплектацию уточните перед бронированием.</small>}
                <section className="detail-box">
                  <h2>Об автомобиле</h2>
                  <div className="specs">
                    {[
                      ['Год выпуска', selected.year],
                      ['Коробка', selected.transmission],
                      ['Двигатель', selected.engine],
                      ['Топливо', selected.fuel],
                      ['Цвет', selected.color],
                      ['Мест', selected.seats || 'Уточняется'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <small>{k}</small>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="detail-box">
                  <h2>Условия аренды</h2>
                  <div className="specs">
                    <div>
                      <small>Депозит</small>
                      <strong>{money(selected.deposit)}</strong>
                    </div>
                    <div>
                      <small>Получение</small>
                      <strong>В офисе</strong>
                    </div>
                    <div>
                      <small>Часы работы</small>
                      <strong>10:00–20:00</strong>
                    </div>
                  </div>
                  <p>
                    Лимит пробега, требования к водителю и условия отмены уточнит менеджер до
                    заключения договора. Заявка не резервирует автомобиль. Онлайн-оплата пока недоступна.
                  </p>
                </section>
                <section className="detail-box">
                  <h2>Офис получения</h2>
                  <h3>Москва, Зелёный проспект, 22</h3>
                  <p>Ежедневно с 10:00 до 20:00, без выходных.</p>
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href="https://yandex.ru/maps/?text=Москва%20Зелёный%20проспект%2022"
                  >
                    Открыть адрес на карте ↗
                  </a>
                </section>
                <section className="detail-box">
                  <h2>Отзывы об этом автомобиле</h2>
                  <div className="empty-review">
                    Пока нет опубликованных отзывов
                    <p>
                      Здесь будут отзывы клиентов именно об этом автомобиле, а не обо всей компании.
                    </p>
                  </div>
                </section>
              </div>
              <aside>
                <div className="booking-card">
                  <div className="price">
                    {money(selected.rate)} <small>/ сутки</small>
                  </div>
                  <span className={`availability-badge ${loading || error ? 'pending' : selected.available ? 'free' : 'busy'}`} role="status">{loading ? 'Проверяем доступность…' : error || selected.label}</span>
                  <button className="text-button" onClick={refresh} disabled={loading}>Проверить ещё раз</button>
                  <hr />
                  <h3>Ваша поездка</h3>
                  <div className="location">
                    Москва, Зелёный проспект, 22
                    <small>Ежедневно 10:00–20:00 · выдача и возврат</small>
                  </div>
                  <div className="date-fields">{dates()}</div>
                  {total ? (
                    <div className="calculation">
                      <p>
                        <span>
                          {total.days} сут. × {money(selected.rate)}
                        </span>
                        <strong>{money(total.total)}</strong>
                      </p>
                      <p>
                        <span>Депозит отдельно</span>
                        <strong>{money(selected.deposit)}</strong>
                      </p>
                      <hr />
                      <p>
                        <b>Стоимость аренды</b>
                        <strong>{money(total.total)}</strong>
                      </p>
                    </div>
                  ) : null}
                  <button
                    className="button wide"
                    disabled={!canBook}
                    onClick={() => setBooking(true)}
                  >
                    Перейти к оформлению →
                  </button>
                  {booking && <Dialog label="Заявка на аренду" onClose={()=>setBooking(false)}><ClientForm vehicle={selected} start={start} end={end} startTime={startTime} endTime={endTime}/></Dialog>}
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>
      <section id="contacts" className="office-section wrap" aria-labelledby="office-title">
        <div className="office-copy"><span className="eyebrow">Контакты</span><h2 id="office-title">Как нас найти</h2><p>Москва, Зелёный проспект, 22</p><p>Ежедневно 10:00–20:00<br/>Без выходных</p><a className="office-phone" href="tel:+79175761177">+7 (917) 576-11-77</a><a className="button" href="https://yandex.ru/maps/org/tg_car/120537769280/" target="_blank" rel="noopener noreferrer">Открыть в Яндекс Картах ↗</a></div>
        <iframe title="Карта офиса TG CAR — Москва, Зелёный проспект, 22" src="https://yandex.ru/map-widget/v1/?oid=120537769280&ol=biz&z=17" width="100%" height="340" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </section>
      <footer>
        <div className="footer-grid wrap">
          <div>
            <a className="brand" href="/" onClick={close}>
              TG <b>CAR</b>
            </a>
            <p>
              Автомобиль под ваш
              <br />
              ритм жизни.
            </p>
            <span className="footer-note">Москва и Московская область</span>
            <SocialButtons/>
          </div>
          <div className="footer-information">
            <h3>Информация</h3>
            <a href="/#reviews" onClick={close}>Отзывы</a>
            <a href="/privacy">Обработка данных</a>
            <StorageSettingsButton/>
            <a href="/about">О нас</a>
            <a href="/#fleet" onClick={close}>
              Автопарк
            </a>
            <a href="/#how" onClick={close}>
              Как арендовать
            </a>
            <a href="/blog" onClick={close}>
              Блог
            </a>
            <button className="text-button" onClick={() => setArticle(3)}>
              Документы и условия
            </button>
          </div>
          <div>
            <h3>Наш офис</h3>
            <a className="contact-phone" href="tel:+79175761177">+7 (917) 576-11-77</a>
            <strong>Москва</strong>
            <p>Зелёный проспект, д. 22</p>
            <p>
              Ежедневно 10:00–20:00
              <br />В выходные тоже работаем
            </p>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://yandex.ru/maps/?rtext=~55.750105,37.788989&rtt=auto"
            >
              Построить маршрут ↗
            </a>
          </div>
          <div>
            <h3>Реквизиты</h3>
            <p>
              ИП Медведев
              <br />
              Сергей Викторович
            </p>
            <p>ИНН 772500473517</p>
          </div>
        </div>
        <div className="footer-bottom wrap">
          <span>© 2026 TG CAR</span>
          <PaymentMarks/>
        </div>
      </footer>
      {article !== null && (
        <Dialog label={['Ваш старт в Москве','Как выбрать автомобиль','Перед получением ключей','Документы сайта'][article]} onClose={()=>setArticle(null)}>
            <h2>
              {
                [
                  'Ваш старт в Москве',
                  'Как выбрать автомобиль',
                  'Перед получением ключей',
                  'Документы сайта',
                ][article]
              }
            </h2>
            {article < 3 ? <JournalContent index={article}/> : <p>
              {
                [
                  'Офис TG CAR: Москва, Зелёный проспект, дом 22. Работаем ежедневно с 10:00 до 20:00. Планируйте получение и возврат автомобиля в часы работы офиса.',
                  'Для городских поездок рассмотрите компактный седан. Если важны простор салона и комфорт на дальних маршрутах, сравните автомобили классов комфорт и бизнес. Перед бронированием проверьте характеристики конкретной машины.',
                  'При получении автомобиля осмотрите кузов и салон вместе с сотрудником, уточните уровень топлива, лимит пробега и порядок возврата. Все согласованные условия должны быть указаны в договоре.',
                  'Оставьте заявку с выбранным автомобилем и датами. Менеджер уточнит доступность и условия аренды. Отправка заявки не заключает договор, не резервирует автомобиль и не требует оплаты.',
                ][article]
              }
            </p>}
            <button className="button" onClick={() => setArticle(null)}>
              Понятно
            </button>
        </Dialog>
      )}
    </>
  );
}
