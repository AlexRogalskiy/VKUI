import React, { useRef, useState, useEffect, FC, HTMLAttributes } from 'react';
import PopoutWrapper from '../PopoutWrapper/PopoutWrapper';
import { ViewWidth, ViewHeight } from '../../hoc/withAdaptivity';
import { ANDROID, IOS, VKCOM } from '../../lib/platform';
import ActionSheetDropdownDesktop from './ActionSheetDropdownDesktop';
import ActionSheetDropdown from './ActionSheetDropdown';
import { hasReactNode } from '../../lib/utils';
import { ActionSheetContext, ItemClickHandler } from './ActionSheetContext';
import Caption from '../Typography/Caption/Caption';
import { usePlatform } from '../../hooks/usePlatform';
import { useTimeout } from '../../hooks/useTimeout';
import { useAdaptivity } from '../../hooks/useAdaptivity';
import './ActionSheet.css';

export type PopupDirectionFunction = (elRef: React.RefObject<HTMLDivElement>) => 'top' | 'bottom';

export interface ActionSheetProps extends HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  text?: React.ReactNode;
  onClose?: VoidFunction;
  /**
   * Desktop only
   */
  toggleRef: Element;
  /**
   * Desktop only
   */
  popupDirection?: 'top' | 'bottom' | PopupDirectionFunction;
  /**
   * iOS only
   */
  iosCloseItem: React.ReactNode;
}

export type AnimationEndCallback = (e?: AnimationEvent) => void;

const ActionSheet: FC<ActionSheetProps> = ({
  children,
  className,
  header,
  text,
  style,
  iosCloseItem,
  ...restProps
}) => {
  const platform = usePlatform();
  const elRef = useRef();
  const [closing, setClosing] = useState(false);
  const onClose = () => setClosing(true);

  const [_closeAction, setCloseAction] = useState<VoidFunction>();
  const afterClose = () => {
    _closeAction && _closeAction();
    setCloseAction(undefined);
  };

  const { viewWidth, viewHeight, hasMouse } = useAdaptivity();
  const isDesktop = viewWidth >= ViewWidth.SMALL_TABLET && (hasMouse || viewHeight >= ViewHeight.MEDIUM);

  const fallbackTransitionFinish = useTimeout(() => {
    restProps.onClose();
    afterClose();
  }, platform === ANDROID || platform === VKCOM ? 200 : 300);
  useEffect(() => {
    if (closing) {
      if (isDesktop) {
        afterClose();
      } else {
        fallbackTransitionFinish.set();
      }
    } else {
      fallbackTransitionFinish.clear();
    }
  }, [closing]);

  const onItemClick: ItemClickHandler = (action, autoclose) => (event) => {
    event.persist();

    if (autoclose) {
      setCloseAction(() => action && action(event));
      setClosing(true);
    } else {
      action && action(event);
    }
  };

  const DropdownComponent = isDesktop
    ? ActionSheetDropdownDesktop
    : ActionSheetDropdown;

  return (
    <PopoutWrapper
      closing={closing}
      alignY="bottom"
      className={className}
      style={style}
      onClick={!isDesktop ? onClose : null}
      hasMask={!isDesktop}
      fixed={!isDesktop}
    >
      <ActionSheetContext.Provider
        value={{
          onItemClick,
          isDesktop,
        }}
      >
        <DropdownComponent
          closing={closing}
          onClose={onClose}
          elementRef={elRef}
          onTransitionEnd={closing && !isDesktop ? afterClose : null}
          {...restProps}
        >
          {(hasReactNode(header) || hasReactNode(text)) &&
            <header vkuiClass="ActionSheet__header">
              {hasReactNode(header) &&
                <Caption level="1" weight={platform === IOS ? 'semibold' : 'medium'} vkuiClass="ActionSheet__title">
                  {header}
                </Caption>
              }
              {hasReactNode(text) && <Caption level="1" weight="regular" vkuiClass="ActionSheet__text">{text}</Caption>}
            </header>
          }
          {children}
          {platform === IOS && !isDesktop && iosCloseItem}
        </DropdownComponent>
      </ActionSheetContext.Provider>
    </PopoutWrapper>
  );
};

ActionSheet.defaultProps = {
  popupDirection: 'bottom',
};

export default ActionSheet;
