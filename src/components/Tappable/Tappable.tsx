import * as React from 'react';
import { Touch, TouchEvent, TouchEventHandler, TouchProps } from '../Touch/Touch';
import TouchRootContext from '../Touch/TouchContext';
import { classNames } from '../../lib/classNames';
import { getClassName } from '../../helpers/getClassName';
import { ANDROID } from '../../lib/platform';
import { getOffsetRect } from '../../lib/offset';
import { coordX, coordY, VKUITouchEvent, VKUITouchEventHander } from '../../lib/touch';
import { HasPlatform, HasRootRef } from '../../types';
import { withPlatform } from '../../hoc/withPlatform';
import { hasHover } from '@vkontakte/vkjs';
import { setRef } from '../../lib/utils';
import { withAdaptivity, AdaptivityProps } from '../../hoc/withAdaptivity';
import { shouldTriggerClickOnEnterOrSpace } from '../../lib/accessibility';
import { FocusVisible, FocusVisibleMode } from '../FocusVisible/FocusVisible';
import { useTimeout } from '../../hooks/useTimeout';
import './Tappable.css';

export interface TappableProps extends React.AllHTMLAttributes<HTMLElement>, HasRootRef<HTMLElement>, HasPlatform, AdaptivityProps {
  Component?: React.ElementType;
  /**
   * Длительность показа active-состояния
   */
  activeEffectDelay?: number;
  stopPropagation?: boolean;
  /**
   * Указывает, должен ли компонент реагировать на hover-состояние
   */
  hasHover?: boolean;
  /**
   * Указывает, должен ли компонент реагировать на active-состояние
   */
  hasActive?: boolean;
  /**
   * Стиль подсветки active-состояния. Если передать произвольную строку, она добавится как css-класс во время active
   */
  activeMode?: 'opacity' | 'background' | string;
  /**
   * Стиль подсветки hover-состояния. Если передать произвольную строку, она добавится как css-класс во время hover
   */
  hoverMode?: 'opacity' | 'background' | string;
  /**
   * Стиль аутлайна focus visible.
   */
  focusVisibleMode?: FocusVisibleMode;
}

interface Wave {
  x: number;
  y: number;
  id: string;
}

export interface TappableState {
  clicks?: Wave[];
  hovered?: boolean;
  active?: boolean;
  hasHover?: boolean;
  hasActive?: boolean;
}

export interface RootComponentProps extends TouchProps {
  ref?: React.Ref<HTMLElement>;
}

export interface StorageItem {
  activeTimeout: ReturnType<typeof setTimeout>;
  timeout?: ReturnType<typeof setTimeout>;
  stop(): void;
}

export interface Storage {
  [index: string]: StorageItem;
}

export type GetStorage = () => StorageItem;

export const ACTIVE_DELAY = 70;
export const ACTIVE_EFFECT_DELAY = 600;

let storage: Storage = {};

/*
 * Очищает таймауты и хранилище для всех экземпляров компонента, кроме переданного
 */
function deactivateOtherInstances(exclude?: string) {
  Object.keys(storage).filter((id: string) => id !== exclude).forEach((id: string) => {
    clearTimeout(storage[id].activeTimeout);
    clearTimeout(storage[id].timeout);
    storage[id].stop();

    delete storage[id];
  });
}

const TappableContext = React.createContext<{ insideTappable?: boolean; onEnter?: VoidFunction; onLeave?: VoidFunction }>({ insideTappable: false });

class Tappable extends React.Component<TappableProps, TappableState> {
  constructor(props: TappableProps) {
    super(props);
    this.id = Math.round(Math.random() * 1e8).toString(16);
    this.state = {
      clicks: [],
      active: false,
      hasHover: props.hasHover,
      hasActive: props.hasActive,
    };
  }

  id: string;

  insideTouchRoot: boolean;

  container: HTMLElement;

  timeout: ReturnType<typeof setTimeout>;

  static defaultProps = {
    stopPropagation: false,
    disabled: false,
    focusVisibleMode: 'inside',
    hasHover,
    hoverMode: 'background',
    hasActive: true,
    activeMode: 'background',
    activeEffectDelay: ACTIVE_EFFECT_DELAY,
  };

  /*
   * [a11y]
   * Обрабатывает событие onkeydown
   * для кастомных доступных элементов:
   * - role="link" (активация по Enter)
   * - role="button" (активация по Space и Enter)
   */
  onKeyDown: React.KeyboardEventHandler = (e: React.KeyboardEvent<HTMLElement>) => {
    const { onKeyDown } = this.props;

    if (shouldTriggerClickOnEnterOrSpace(e)) {
      e.preventDefault();
      this.container.click();
    }

    {
      if (typeof onKeyDown === 'function') {
        return onKeyDown(e);
      }
    }
  };

  /*
   * Обрабатывает событие touchstart
   */
  onStart: TouchEventHandler = ({ originalEvent }: TouchEvent) => {
    !this.insideTouchRoot && this.props.stopPropagation && originalEvent.stopPropagation();

    if (this.state.hasActive) {
      if (originalEvent.touches && originalEvent.touches.length > 1) {
        deactivateOtherInstances();
        return;
      }

      if (this.props.platform === ANDROID) {
        this.onDown(originalEvent);
      }

      storage[this.id] = {
        stop: this.stop,
        activeTimeout: setTimeout(this.start, ACTIVE_DELAY),
      };
    }
  };

  /*
   * Обрабатывает событие touchmove
   */
  onMove: TouchEventHandler = ({ originalEvent, isSlide }: TouchEvent) => {
    !this.insideTouchRoot && this.props.stopPropagation && originalEvent.stopPropagation();
    if (isSlide) {
      this.stop();
    }
  };

  /*
   * Обрабатывает событие touchend
   */
  onEnd: TouchEventHandler = ({ originalEvent, isSlide, duration }: TouchEvent) => {
    !this.insideTouchRoot && this.props.stopPropagation && originalEvent.stopPropagation();

    if (originalEvent.touches && originalEvent.touches.length > 0) {
      this.stop();
      return;
    }

    if (this.state.active) {
      if (duration >= 100) {
        // Долгий тап, выключаем подсветку
        this.stop();
      } else {
        // Короткий тап, оставляем подсветку
        const timeout = setTimeout(this.stop, this.props.activeEffectDelay - duration);
        const store = this.getStorage();

        if (store) {
          store.timeout = timeout;
        }
      }
    } else if (!isSlide) {
      // Очень короткий тап, включаем подсветку
      this.start();

      const timeout = setTimeout(this.stop, this.props.activeEffectDelay);

      if (this.getStorage()) {
        clearTimeout(this.getStorage().activeTimeout);
        this.getStorage().timeout = timeout;
      } else {
        this.timeout = timeout;
      }
    }
  };

  /*
   * Реализует эффект при тапе для Андроида
   */
  onDown: VKUITouchEventHander = (e: VKUITouchEvent) => {
    if (this.props.platform === ANDROID) {
      const { top, left } = getOffsetRect(this.container);
      const x = coordX(e) - left;
      const y = coordY(e) - top;

      this.setState({
        clicks: [...this.state.clicks, { x, y, id: Date.now().toString() }],
      });
    }
  };

  onEnter = () => {
    this.setState({ hovered: true });
  };

  onLeave = () => {
    this.setState({ hovered: false });
  };

  /*
   * Устанавливает активное выделение
   */
  start: VoidFunction = () => {
    if (!this.state.active && this.state.hasActive) {
      this.setState({
        active: true,
      });
    }
    deactivateOtherInstances(this.id);
  };

  /*
   * Снимает активное выделение
   */
  stop: VoidFunction = () => {
    if (this.state.active) {
      this.setState({
        active: false,
      });
    }
    if (this.getStorage()) {
      clearTimeout(this.getStorage().activeTimeout);
      delete storage[this.id];
    }
  };

  /*
   * Возвращает хранилище для экземпляра компонента
   */
  getStorage: GetStorage = () => {
    return storage[this.id];
  };

  /*
   * Берет ref на DOM-ноду из экземпляра Touch
   */
  getRef: React.RefCallback<HTMLElement> = (container) => {
    this.container = container;
    setRef(container, this.props.getRootRef);
  };

  componentWillUnmount() {
    if (storage[this.id]) {
      clearTimeout(storage[this.id].timeout);
      clearTimeout(storage[this.id].activeTimeout);

      delete storage[this.id];
    }
  }

  componentDidUpdate(prevProps: TappableProps) {
    if (prevProps.hasHover !== this.props.hasHover || prevProps.hasActive !== this.props.hasActive) {
      this.setState({ hasHover: this.props.hasHover, hasActive: this.props.hasActive });
    }
    if (!prevProps.disabled && this.props.disabled) {
      this.setState({ hovered: false });
    }
  }

  removeWave(id: Wave['id']) {
    this.setState({ clicks: this.state.clicks.filter((c) => c.id !== id) });
  }

  render() {
    const { clicks, active, hovered, hasHover, hasActive } = this.state;

    const defaultComponent: React.ElementType = this.props.href ? 'a' : 'div';

    const {
      children,
      Component = defaultComponent,
      onClick,
      onKeyDown,
      activeEffectDelay,
      stopPropagation,
      getRootRef,
      platform,
      sizeX,
      hasMouse,
      hasHover: propsHasHover,
      hoverMode,
      hasActive: propsHasActive,
      activeMode,
      focusVisibleMode,
      ...restProps
    } = this.props;

    const isCustomElement: boolean = Component !== 'a' && Component !== 'button' && !restProps.contentEditable;

    const isPresetHoverMode = ['opacity', 'background'].includes(hoverMode);
    const isPresetActiveMode = ['opacity', 'background'].includes(activeMode);

    const classes = classNames(
      getClassName('Tappable', platform),
      `Tappable--sizeX-${sizeX}`,
      {
        'Tappable--active': hasActive && active,
        'Tappable--inactive': !active,
        'Tappable--mouse': hasMouse,
        [`Tappable--hover-${hoverMode}`]: hasHover && hovered && isPresetHoverMode,
        [`Tappable--active-${activeMode}`]: hasActive && active && isPresetActiveMode,
        [hoverMode]: hasHover && hovered && !isPresetHoverMode,
        [activeMode]: hasActive && active && !isPresetActiveMode,
      });

    const RootComponent = restProps.disabled
      ? Component
      : Touch;

    let props: RootComponentProps = {};
    if (!restProps.disabled) {
      props.Component = Component;
      /* eslint-disable */
      props.onStart = this.onStart;
      props.onMove = this.onMove;
      props.onEnd = this.onEnd;
      props.onClick = onClick;
      props.onKeyDown = isCustomElement ? this.onKeyDown : onKeyDown;
      props.slideThreshold = 20;
      /* eslint-enable */
      props.getRootRef = this.getRef;
    } else {
      props.ref = this.getRef;
    }

    if (isCustomElement) {
      props['aria-disabled'] = restProps.disabled;
    }

    const role: string = restProps.href ? 'link' : 'button';

    return (
      <TappableContext.Consumer>
        {({ insideTappable, onEnter, onLeave }) => {
          return (
            <TouchRootContext.Consumer>
              {(insideTouchRoot: boolean) => {
                this.insideTouchRoot = insideTouchRoot;
                const touchProps = restProps.disabled ? {} : {
                  onEnter: () => {
                    insideTappable && onEnter();
                    !restProps.disabled && this.onEnter();
                  },
                  onLeave: () => {
                    insideTappable && onLeave();
                    !restProps.disabled && this.onLeave();
                  },
                };
                return (
                  <RootComponent
                    {...touchProps}
                    type={Component === 'button' ? 'button' : undefined}
                    tabIndex={isCustomElement && !restProps.disabled ? 0 : undefined}
                    role={isCustomElement ? role : undefined}
                    {...restProps}
                    vkuiClass={classes}
                    {...props}>
                    <TappableContext.Provider
                      value={{
                        insideTappable: true,
                        onEnter: () => this.setState({ hasHover: false, hasActive: false }),
                        onLeave: () => this.setState({ hasHover: propsHasHover, hasActive: propsHasActive }),
                      }}
                    >
                      {children}
                    </TappableContext.Provider>
                    {platform === ANDROID && !hasMouse && hasActive && activeMode === 'background' && (
                      <span aria-hidden="true" vkuiClass="Tappable__waves">
                        {clicks.map((wave) => (
                          <Wave {...wave} key={wave.id} onClear={() => this.removeWave(wave.id)} />
                        ))}
                      </span>
                    )}
                    {hasHover && hoverMode === 'background' && <span aria-hidden="true" vkuiClass="Tappable__hoverShadow" />}
                    {!restProps.disabled && <FocusVisible mode={focusVisibleMode} />}
                  </RootComponent>
                );
              }}
            </TouchRootContext.Consumer>
          );
        }}
      </TappableContext.Consumer>
    );
  }
}

export default withAdaptivity(withPlatform(Tappable), { sizeX: true, hasMouse: true });

function Wave({ x, y, onClear }: Wave & { onClear: VoidFunction }) {
  const timeout = useTimeout(onClear, 225);
  React.useEffect(() => timeout.set(), []);
  return <span vkuiClass="Tappable__wave" style={{ top: y, left: x }} />;
}
