import { getRandomInteger, getRandomArrayElement } from '../utils.js/common.js';
import { POINTS_TYPES } from './const.js';
import { getRandomDates } from './dates.js';
import { getDestination } from './destination.js';
import { getOfferByType } from './offer.js';

const MIN_ARRAY_LENGTH = 0;
const DESTINATIONS_COUNT = 6;
const OFFERS_BY_TYPE_COUNT = 8;
const BasePrice = {
  MIN: 200,
  MAX: 2000
};

//если делать это в функции, то генерируются разные массивы в представлениях point-view и edit-point-view, что ломает правильное отображение данных на странице. Поэтому  удобнее оставить данные в костантах.
const offersByType = Array.from({ length: OFFERS_BY_TYPE_COUNT }, getOfferByType);
const destinations = Array.from({ length: DESTINATIONS_COUNT }, (value, index) => getDestination(index));

const getRandomOffersIds = () => {
  const randomOffers = getRandomArrayElement(offersByType).offers;

  const ids = [];
  const lengthOfArray = getRandomInteger(MIN_ARRAY_LENGTH, randomOffers.length);
  while (ids.length <= lengthOfArray) {
    const currentElement = getRandomInteger(MIN_ARRAY_LENGTH, randomOffers.length);
    if (!ids.includes(currentElement)) {
      ids.push(currentElement);
    }
  }

  return ids;
};

const getRandomPoint = (count) => {
  const randomDates = getRandomDates();

  return {
    basePrice: getRandomInteger(BasePrice.MIN, BasePrice.MAX),
    dateFrom: randomDates.dateFrom,
    dateTo: randomDates.dateTo,
    destination: getRandomArrayElement(destinations).id,
    id: count,
    offers: getRandomOffersIds(),
    type: getRandomArrayElement(POINTS_TYPES)
  };
};

export {getRandomPoint, offersByType, destinations};
