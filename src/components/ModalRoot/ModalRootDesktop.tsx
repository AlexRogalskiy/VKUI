import * as React from 'react';
import { classNames } from '../../lib/classNames';
import { isFunction } from '../../lib/utils';
import { transitionEvent } from '../../lib/supportEvents';
import { HasPlatform } from '../../types';
import { withPlatform } from '../../hoc/withPlatform';
import { withContext } from '../../hoc/withContext';
import ModalRootContext, { ModalRootContextInterface } from './ModalRootContext';
import {
  ConfigProviderContext,
  ConfigProviderContextInterface,
  WebviewType,
} from '../ConfigProvider/ConfigProviderContext';
import { ModalsStateEntry } from './types';
import { ANDROID, VKCOM } from '../../lib/platform';
import { getClassName } from '../../helpers/getClassName';
import { DOMProps, withDOM } from '../../lib/dom';
import { getNavId } from '../../lib/getNavId';
import { warnOnce } from '../../lib/warnOnce';
import { FocusTrap } from '../FocusTrap/FocusTrap';
import { ModalTransitionProps, withModalManager } from './useModalManager';
import './ModalRoot.css';

const warn = warnOnce('ModalRoot');
const IS_DEV = process.env.NODE_ENV === 'development';

export interface ModalRootProps extends HasPlatform {
  activeModal?: string | null;
  /**
   * @ignore
   */
  configProvider?: ConfigProviderContextInterface;

  /**
   * Будет вызвано при закрытии активной модалки с её id
   */
  onClose?(modalId: string): void;
}

class ModalRootDesktopComponent extends React.Component<ModalRootProps & DOMProps & ModalTransitionProps> {
  constructor(props: ModalRootProps & ModalTransitionProps) {
    super(props);

    this.maskElementRef = React.createRef();

    this.modalRootContext = {
      updateModalHeight: () => undefined,
      registerModal: ({ id, ...data }) => Object.assign(this.modalsState[id], data),
      onClose: this.triggerActiveModalClose,
      isInsideModal: true,
    };
  }

  private readonly maskElementRef: React.RefObject<HTMLDivElement>;
  private maskAnimationFrame: number;
  private readonly modalRootContext: ModalRootContextInterface;

  get timeout() {
    return this.props.platform === ANDROID || this.props.platform === VKCOM ? 320 : 400;
  }

  get modals() {
    return React.Children.toArray(this.props.children) as React.ReactElement[];
  }

  get modalsState() {
    return this.props.modalsState;
  }

  componentDidUpdate(prevProps: ModalRootProps & ModalTransitionProps) {
    // transition phase 2: animate exiting modal
    if (this.props.exitingModal && this.props.exitingModal !== prevProps.exitingModal) {
      this.closeModal(this.props.exitingModal);
    }

    // transition phase 3: animate entering modal
    if (this.props.enteringModal && this.props.enteringModal !== prevProps.enteringModal) {
      const { enteringModal } = this.props;
      const enteringState = this.modalsState[enteringModal];
      requestAnimationFrame(() => {
        if (this.props.enteringModal === enteringModal) {
          this.waitTransitionFinish(enteringState, () => this.props.onEnter(enteringModal));
          this.animateModalOpacity(enteringState, true);
        }
      });
    }
  }

  closeModal(id: string) {
    const prevModalState = this.modalsState[id];
    if (!prevModalState) {
      return;
    }

    this.waitTransitionFinish(prevModalState, () => this.props.onExit(id));
    this.animateModalOpacity(prevModalState, false);
    if (!this.props.activeModal) {
      this.setMaskOpacity(prevModalState, 0);
    }
  }

  waitTransitionFinish(modalState: ModalsStateEntry, eventHandler: () => void) {
    if (transitionEvent.supported) {
      const onceHandler = () => {
        modalState.innerElement.removeEventListener(transitionEvent.name, onceHandler);
        eventHandler();
      };

      modalState.innerElement.addEventListener(transitionEvent.name, onceHandler);
    } else {
      setTimeout(eventHandler, this.timeout);
    }
  }

  /* Анимирует сдивг модалки */
  animateModalOpacity(modalState: ModalsStateEntry, display: boolean) {
    modalState.innerElement.style.opacity = display ? '1' : '0';
  }

  /* Устанавливает прозрачность для полупрозрачной подложки */
  setMaskOpacity(modalState: ModalsStateEntry, forceOpacity: number = null) {
    if (forceOpacity === null && this.props.history[0] !== modalState.id) {
      return;
    }

    cancelAnimationFrame(this.maskAnimationFrame);
    this.maskAnimationFrame = requestAnimationFrame(() => {
      if (this.maskElementRef.current) {
        const { translateY, translateYCurrent } = modalState;

        const opacity = forceOpacity === null ? 1 - (translateYCurrent - translateY) / (100 - translateY) || 0 : forceOpacity;
        this.maskElementRef.current.style.opacity = Math.max(0, Math.min(100, opacity)).toString();
      }
    });
  }

  /**
   * Закрывает текущую модалку
   */
  triggerActiveModalClose = () => {
    const activeModalState = this.modalsState[this.props.activeModal];
    if (activeModalState) {
      this.doCloseModal(activeModalState);
    }
  };

  private readonly doCloseModal = (modalState: ModalsStateEntry) => {
    if (isFunction(modalState.onClose)) {
      modalState.onClose();
    } else if (isFunction(this.props.onClose)) {
      this.props.onClose(modalState.id);
    } else if (IS_DEV) {
      warn('onClose is undefined');
    }
  };

  render() {
    const { exitingModal, activeModal, enteringModal } = this.props;

    if (!activeModal && !exitingModal) {
      return null;
    }

    return (
      <ModalRootContext.Provider value={this.modalRootContext}>
        <div
          vkuiClass={classNames(getClassName('ModalRoot', this.props.platform), {
            'ModalRoot--vkapps': this.props.configProvider.webviewType === WebviewType.VKAPPS,
          }, 'ModalRoot--desktop')}
        >
          <div
            vkuiClass="ModalRoot__mask"
            onClick={this.triggerActiveModalClose}
            ref={this.maskElementRef}
          />
          <div vkuiClass="ModalRoot__viewport">
            {this.modals.map((Modal: React.ReactElement) => {
              const modalId = getNavId(Modal.props, warn);
              if (modalId !== activeModal && modalId !== exitingModal) {
                return null;
              }

              const key = `modal-${modalId}`;

              return (
                <FocusTrap
                  restoreFocus={false}
                  onClose={this.triggerActiveModalClose}
                  timeout={this.timeout}
                  key={key}
                  vkuiClass={classNames('ModalRoot__modal', {
                    'ModalRoot__modal--active': !exitingModal && !enteringModal && modalId === activeModal,
                    'ModalRoot__modal--prev': modalId === exitingModal,
                    'ModalRoot__modal--next': exitingModal && modalId === activeModal,
                  })}
                >{Modal}</FocusTrap>
              );
            })}
          </div>
        </div>
      </ModalRootContext.Provider>
    );
  }
}

export const ModalRootDesktop = withContext(
  withPlatform(
    withDOM<ModalRootProps>(
      withModalManager()(ModalRootDesktopComponent),
    ),
  ),
  ConfigProviderContext, 'configProvider');
