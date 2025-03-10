import PointListView from '../view/points-view.js';
import NoPointsView from '../view/no-points-view.js';
import NewPointPresenter from './new-point-presenter.js';
import { remove, render, RenderPosition } from '../framework/render.js';
import PointPresenter from './point-presenter.js';
import SortView from '../view/sort-view.js';
import { getSort } from '../utils/sort.js';
import { SortType, defaultNewPoint } from '../const.js';
import { getSortedPoints } from '../utils/sort.js';
import { UpdateType, UserAction, FilterType, TimeLimit } from '../const.js';
import { filter } from '../utils/filter.js';
import LoadingView from '../view/loading-view.js';
import UiBlocker from '../framework/ui-blocker/ui-blocker.js';
import ErrorLoadView from '../view/error-load-view.js';
import NewPointButtonView from '../view/new-point-button-view.js';
import TripInfoPresenter from './trip-info-presenter.js';


export default class TripPresenter {
  #pointListComponent = new PointListView();
  #loadingComponent = new LoadingView();
  #listPoints = [];
  #pointsContainer = null;
  #tripInfoContainer = null;
  #tripInfoPresenter = null;
  #pointsModel = null;
  #filterModel = null;
  #newPointPresenter = null;
  #sortComponent = null;
  #sortOptions = getSort();
  #currentSortType = SortType.DAY;
  #pointPresenter = new Map();
  #headerContainer = null;
  #noPointComponent = null;
  #newPointButtonContainer = null;
  #newPointButtonComponent = null;
  #filterType = FilterType.EVERYTHING;
  #isLoading = true;
  #errorLoadComponent = null;
  #uiBlocker = new UiBlocker({
    lowerLimit: TimeLimit.LOWER_LIMIT,
    upperLimit: TimeLimit.UPPER_LIMIT
  });


  constructor({pointsContainer,tripInfoContainer, pointsModel, filterModel, headerFiltersElement, newPointButtonContainer}) {
    this.#pointsContainer = pointsContainer;
    this.#tripInfoContainer = tripInfoContainer;
    this.#pointsModel = pointsModel;
    this.#filterModel = filterModel;
    this.#headerContainer = headerFiltersElement;
    this.#newPointButtonContainer = newPointButtonContainer;

    this.#newPointPresenter = new NewPointPresenter({
      pointListContainer: this.#pointListComponent.element,
      onDataChange: this.#handleViewAction,
      onDestroy: this.#handleNewPointFormClose
    });

    this.#tripInfoPresenter = new TripInfoPresenter({
      tripInfoContainer: this.#tripInfoContainer,
      pointsModel: this.#pointsModel,
      filteredPoints: this.points
    });


    this.#pointsModel.addObserver(this.#handleModelEvent);
    this.#filterModel.addObserver(this.#handleModelEvent);
  }

  init() {

    this.#renderTripRoute();
  }

  createPoint() {
    const point = defaultNewPoint;
    this.#currentSortType = SortType.DAY;
    this.#filterModel.setFilter(UpdateType.MAJOR, FilterType.EVERYTHING);
    this.#newPointPresenter.init(point, this.destinations, this.offers, this.cities);
  }

  get points() {
    this.#filterType = this.#filterModel.filter;
    const points = [...this.#pointsModel.points];
    const filteredPoints = filter[this.#filterType](points);

    switch (this.#currentSortType) {
      case SortType.DAY:
        return getSortedPoints(filteredPoints, SortType.DAY);
      case SortType.PRICE:
        return getSortedPoints(filteredPoints, SortType.PRICE);
      case SortType.TIME:
        return getSortedPoints(filteredPoints, SortType.TIME);
    }

    return filteredPoints;
  }

  get offers() {
    return [...this.#pointsModel.offers];
  }

  get destinations() {
    return [...this.#pointsModel.destinations];
  }

  get cities() {
    return [...this.#pointsModel.cities];
  }


  #handleViewAction = async (actionType, updateType, update) => {
    this.#uiBlocker.block();

    switch (actionType) {
      case UserAction.UPDATE_POINT:
        this.#pointPresenter.get(update.id).setSaving();
        try {
          await this.#pointsModel.updatePoint(updateType, update);
        } catch (err) {
          this.#pointPresenter.get(update.id).setAborting();
        }
        break;

      case UserAction.ADD_POINT:
        this.#newPointPresenter.setSaving();
        try {
          await this.#pointsModel.addPoint(updateType, update);
        } catch (err) {
          this.#newPointPresenter.setAborting();
        }
        break;

      case UserAction.DELETE_POINT:
        this.#pointPresenter.get(update.id).setDeleting();
        try {
          await this.#pointsModel.deletePoint(updateType, update);
        } catch (err) {
          this.#pointPresenter.get(update.id).setAborting();
        }
        break;
    }

    this.#uiBlocker.unblock();
  };

  #handleModelEvent = (updateType, data) => {
    switch (updateType) {
      case UpdateType.PATCH:
        this.#pointPresenter.get(data.id).init(data);
        break;
      case UpdateType.MINOR:
        this.#clearTripRoute();
        this.#renderTripRoute();
        break;
      case UpdateType.MAJOR:
        this.#clearTripRoute({ resetSortType: true });
        this.#renderTripRoute();
        break;
      case UpdateType.INIT:
        this.#isLoading = false;
        remove(this.#loadingComponent);
        this.#renderTripRoute();
        break;
    }
  };

  #renderLoading() {
    render(this.#loadingComponent, this.#pointsContainer);
  }


  #renderNoPoints() {
    this.#noPointComponent = new NoPointsView({
      filterType: this.#filterType
    });
    render(this.#noPointComponent, this.#pointsContainer);
  }


  #renderPoint(point) {
    const pointPresenter = new PointPresenter ({
      pointsContainer: this.#pointListComponent.element,
      allDestinations: this.destinations,
      allOffers: this.offers,
      allCities: this.cities,
      onDataChange: this.#handleViewAction,
      onModeChange: this.#handleModeChange,
    });

    pointPresenter.init(point, this.allDestinations, this.allOffers);
    this.#pointPresenter.set(point.id, pointPresenter);
  }

  #renderSort() {
    this.#sortComponent = new SortView ({
      sortOptions: this.#sortOptions,
      currentSortType: this.#currentSortType,
      onSortTypeChange: this.#handleSortTypeChange
    });
    render(this.#sortComponent, this.#pointListComponent.element, RenderPosition.BEFOREBEGIN);
  }


  #handleSortTypeChange = (sortType) => {
    if (this.#currentSortType === sortType) {
      return;
    }

    if (sortType === SortType.EVENT || sortType === SortType.OFFERS) {
      return;
    }

    this.#currentSortType = sortType;
    this.#clearTripRoute();
    this.#renderTripRoute();
  };

  #handleModeChange = () => {
    this.#newPointPresenter.destroy();
    this.#pointPresenter.forEach((presenter) => presenter.resetView());
  };


  #clearTripRoute({ resetSortType = false } = {}) {

    this.#pointPresenter.forEach((presenter) => presenter.destroy());
    this.#pointPresenter.clear();
    this.#newPointPresenter.destroy();


    remove(this.#sortComponent);
    remove(this.#loadingComponent);

    if (this.#noPointComponent) {
      remove(this.#noPointComponent);
    }

    if (resetSortType) {
      this.#currentSortType = SortType.DAY;
    }

    this.#tripInfoPresenter.destroy();
  }


  #handleNewPointFormClose = () => {
    this.#newPointButtonComponent.element.disabled = false;
  };

  #handleNewPointButtonClick = () => {
    this.createPoint();
    this.#newPointButtonComponent.element.disabled = true;
  };

  #renderNewPointButton() {
    if (!this.#newPointButtonComponent) {
      this.#newPointButtonComponent = new NewPointButtonView({
        newPointButtonContainer: this.#newPointButtonContainer,
        onNewPointButtonClick: this.#handleNewPointButtonClick
      });
      render(this.#newPointButtonComponent, this.#newPointButtonContainer);
    }
  }


  #renderTripRoute() {
    render(this.#pointListComponent, this.#pointsContainer);

    if (this.#isLoading) {
      this.#renderLoading();
      return;
    }

    const pointsCount = this.points.length;

    if (pointsCount === 0 && this.offers.length && this.destinations.length) {
      this.#renderNoPoints();
      this.#renderNewPointButton();
      return;
    }

    if (this.offers.length === 0 || this.destinations.length === 0) {
      const prevErrComponent = this.#errorLoadComponent;
      this.#errorLoadComponent = new ErrorLoadView();
      if (prevErrComponent === null){
        render (this.#errorLoadComponent, this.#pointsContainer);
      }
    }


    this.points.forEach((point) => this.#renderPoint(point));
    if (!this.#errorLoadComponent){
      this.#renderSort();
      this.#renderNewPointButton();
    }


    this.#tripInfoPresenter.init();
  }
}

