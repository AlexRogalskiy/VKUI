import React, { HTMLAttributes, RefCallback } from 'react';
import { getClassName } from '../../helpers/getClassName';
import { classNames } from '../../lib/classNames';
import { transitionEndEventName, transitionEvents, TransitionStartEventDetail, transitionStartEventName } from '../View/View';
import { withContext } from '../../hoc/withContext';
import { HasPlatform, HasRootRef } from '../../types';
import { withPlatform } from '../../hoc/withPlatform';
import { withPanelContext } from '../Panel/withPanelContext';
import { setRef } from '../../lib/utils';
import { SplitColContext, SplitColContextProps } from '../SplitCol/SplitCol';
import { TooltipContainer } from '../Tooltip/TooltipContainer';
import { PanelContextProps } from '../Panel/PanelContext';
import { DOMProps, withDOM } from '../../lib/dom';

export interface FixedLayoutProps extends
  HTMLAttributes<HTMLDivElement>,
  HasRootRef<HTMLDivElement>,
  HasPlatform {
  vertical?: 'top' | 'bottom';
  /**
   * Это свойство определяет, будет ли фон компонента окрашен в цвет фона контента.
   * Это часто необходимо для фиксированных кнопок в нижней части экрана.
   */
  filled?: boolean;
  /**
   * @ignore
   */
  splitCol?: SplitColContextProps;
}

export interface FixedLayoutState {
  position: 'absolute' | null;
  top: number;
  width: string;
}

class FixedLayout extends React.Component<FixedLayoutProps & DOMProps & PanelContextProps, FixedLayoutState> {
  state: FixedLayoutState = {
    position: 'absolute',
    top: null,
    width: '',
  };

  el: HTMLDivElement;

  private onMountResizeTimeout: number;

  get document() {
    return this.props.document;
  }

  get window() {
    return this.props.window;
  }

  get currentPanel(): HTMLElement {
    const elem = this.props.getPanelNode();

    if (!elem) {
      console.warn('[VKUI/FixedLayout] Panel element not found');
    }

    return elem;
  }

  get canTargetPanelScroll() {
    const panelEl = this.currentPanel;
    if (!panelEl) {
      return true; // Всегда предпологаем, что может быть скролл в случае, если нет document
    }
    return panelEl.scrollHeight > panelEl.clientHeight;
  }

  componentDidMount() {
    this.onMountResizeTimeout = setTimeout(() => this.doResize());
    this.window.addEventListener('resize', this.doResize);

    transitionEvents.on(transitionStartEventName, this.onViewTransitionStart);
    transitionEvents.on(transitionEndEventName, this.onViewTransitionEnd);
  }

  componentWillUnmount() {
    clearInterval(this.onMountResizeTimeout);
    this.window.removeEventListener('resize', this.doResize);

    transitionEvents.off(transitionStartEventName, this.onViewTransitionStart);
    transitionEvents.off(transitionEndEventName, this.onViewTransitionEnd);
  }

  onViewTransitionStart: EventListener = (e: CustomEvent<TransitionStartEventDetail>) => {
    const { from, to, scrolls } = e.detail;
    const { panel } = this.props;
    const panelScroll = scrolls[panel] || 0;
    const fromPanelHasScroll = panel === from && panelScroll > 0;
    const toPanelHasScroll = panel === to && panelScroll > 0;

    // Для панелей, с которых уходим всегда выставляется скролл
    // Для панелей на которые приходим надо смотреть, есть ли браузерный скролл
    if (fromPanelHasScroll || toPanelHasScroll && this.canTargetPanelScroll) {
      this.setState({
        position: 'absolute',
        top: this.el.offsetTop + panelScroll,
        width: '',
      });
    }
  };

  onViewTransitionEnd: VoidFunction = () => {
    this.setState({
      position: null,
      top: null,
    });

    this.doResize();
  };

  doResize = () => {
    const { colRef } = this.props.splitCol;

    if (colRef && colRef.current) {
      const node: HTMLElement = colRef.current;
      const width = node.offsetWidth;

      this.setState({ width: `${width}px`, position: null });
    } else {
      this.setState({ width: '', position: null });
    }
  };

  getRef: RefCallback<HTMLDivElement> = (element) => {
    this.el = element;
    setRef(element, this.props.getRootRef);
  };

  render() {
    const {
      className, children, style, vertical, getRootRef, platform, filled, splitCol,
      panel, getPanelNode, window, document, ...restProps } = this.props;

    return (
      <TooltipContainer
        {...restProps}
        fixed
        ref={this.getRef}
        className={classNames(getClassName('FixedLayout', platform), {
          'FixedLayout--filled': filled,
        }, `FixedLayout--${vertical}`, className)}
        style={{ ...style, ...this.state }}
      >
        <div className="FixedLayout__in">{children}</div>
      </TooltipContainer>
    );
  }
}

export default withContext(
  withPlatform(withPanelContext(withDOM<FixedLayoutProps>(FixedLayout))),
  SplitColContext,
  'splitCol',
);
