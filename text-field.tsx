import { Component, Host, h, Prop, Event, Method, VNode, State, Element, Watch, writeTask, EventEmitter, Fragment } from '@stencil/core';
import debounce from '../../utils/debounce';
import { getElementDir } from '../../utils/direction';
import { deepCopy } from '../../utils/deep-copy';
import { FormValidation } from '../../utils/form-validation';
import { hasSlot } from '../../utils/slot';
import { ITextField } from '../../types/exports/bricks-text-field';
import Popper from '../../utils/floatingUI';
import type { Attributes } from '../../utils/helpers';
import { inheritAriaAttributes, inheritDataAttributesFromHost } from '../../utils/helpers';
import { TypeaheadSuggestion, setTypeaheadSuggestedValue } from '../../utils/typeahead';

/**
 * TODO (4.0.0): Remove deprecated properties
 */

let id = 0;

const TYPE_AHEAD = 'typeahead';
const SEARCH = 'search';
const SECURE = 'secure';
const INVALID = 'invalid';
const STANDARD = 'standard';
const TOKENISED = 'tokenised';

const validationIcon = {
  valid: 'checkmarkcircle',
  invalid: 'exclamation',
  neutral: 'circle'
};

const internalValidationStrings: ITextField.internalValidationStrings = {
  pattern: "Value doesn't match the required pattern",
  required: 'This field is required',
  minLength: (min: number) => {
    return `Minimum ${min} characters required`;
  },
  maxLength: (max: number) => {
    return `Maximum ${max} characters allowed`;
  }
};

/**
 * @storybookPath text-fields
 * @designGuidelinePath textfields
 *
 * @slot (accessory-icon) - Slot for holding the accesory icon. Currently we provide the basic accessory icons through accessoryIcon property. Custom icons can be provided through this slot
 * @slot (prefix-icon) - Slot for holding the prefix icon. This will come in place of search icon and will only be enabled if search icon is not enabled by any means
 *
 * @part base - CSS part for Base element
 * @part accessory-icon - CSS part for accessory icons such as clear(X), calendar, etc
 * @part helper-text - CSS part for helper text string
 * @part label - CSS part for label
 * @part loading-icon - CSS part for loading icon
 * @part search-icon - CSS part for search icon
 * @part tokens - CSS part for tokens in tokenised field
 * @part state-info - CSS part for state-info
 * @part input - CSS part for input control
 * @part arrow - CSS part for multidimensional validation tooltip arrow
 */
@Component({
  tag: 'bricks-text-field',
  styleUrl: 'bricks-text-field.scss',
  shadow: true
})
export class BricksTextField {
  private inheritedAttributes: Attributes = {};

  private inheritedDataAttributes: { [key: string]: string } = {};

  @Element() elHost: HTMLBricksTextFieldElement;

  /**
   * Reference to wrapper span element
   */
  private elBase: HTMLSpanElement;

  /**
   * FloatingUI instance
   */
  private popper: Popper;

  /**
   * Reference to span element of hinttext, especially for screen-readers
   */
  private elHelperText: HTMLSpanElement;

  /**
   * Reference to underlying input element
   */
  private elInput: HTMLInputElement;

  /**
   * Reference to the tooltip elemeny in case of multi state validation
   */
  private elTooltip: HTMLDivElement;

  /**
   * Reference to underlying textarea element for typeahead variation
   */
  private elTextArea: HTMLTextAreaElement;

  /**
   * Reference to input element for typeahead variation
   */
  private elTypeaheadInput: HTMLInputElement;

  /**
   * Reference to label element
   */
  private elLabel: HTMLLabelElement;

  /**
   * Reference to underlying menu button for typeahead variation
   */
  private elTypeAheadMenuButton: HTMLBricksMenuButtonElement;

  /**
   * Reference to underlying menu button for typeahead variation
   */
  private elMenu: HTMLBricksMenuElement;

  /**
   * Reference to tokens wrapper span element
   */
  private elTokensWrapper: HTMLSpanElement;

  /**
   * Unique identifier for the component's instance
   */
  private componentId = `text-field-${++id}`;

  /**
   * Internal boolean variable which suggests if all tokens are selected. If selected, pressing delete would delete all of them;
   */
  private allTokensSelected = false;

  /**
   * Draggable source element
   */
  private dragSourceToken: HTMLSpanElement;

  /**
   * Element reference to accessory icon
   */
  private hasAccessoryIconslot: HTMLElement;

  /**
   * Element reference to the arrow element
   */
  private arrow: HTMLElement;

  /**
   * Options which are visible in typeahead menu as per the text entered
   */
  @State() visibleOptions: ITextField.TypeAheadOption[] = [];

  /**
   * Options which are visible in typeahead menu as per the text entered
   */
  @State() tokenisedValues: string[] = [];

  /**
   * Internal state to store if the prefix icon is present
   */
  @State() hasPrefixIconSlot = false;

  /**
   * Array which stores the internal validation info which requires to display in multidimensional tooltip
   * when `showInternalValidationsInMultiDimensionalTooltip` is set true.
   */
  @State() internalValidationStateArray: ITextField.Validation[] = [];

  /**
   * Manages the valid and invalid state of the text field which is maintained internally
   */
  @State() internalFieldValidationState: ITextField.ValidationState = { status: 'valid', message: 'This text field is valid' };

  @State() maskedValue: ITextField.maskedValue = '';

  /**
   * Label for the text field, especially for screen-readers. Default: ''
   */
  @Prop({ reflect: true }) label: ITextField.label;

  /**
   * Show subtitle along with label in text-field when showSubtitleInSelectedText is true. Default: false
   */
  @Prop() showSubtitleInSelectedText: ITextField.showSubtitleInSelectedText = false;

  /**
   * Different variations of text field. Default: 'standard'
   */
  @Prop({ reflect: true }) variation: ITextField.variation = 'standard';

  /**
   * Whether the text field is of normal type or floating label type
   */
  @Prop({ reflect: true }) visualStyle: ITextField.visualStyle = 'default';

  /**
   * Value for the text field. Default: ''
   */
  // eslint-disable-next-line @stencil/strict-mutable
  @Prop({ mutable: true }) value: ITextField.value = '';

  /**
   * Determines if the text field is disabled or not. Default: false
   */
  @Prop() disabled: ITextField.disabled = false;

  /**
   * Determines if the text field is read-only or not. Default: false
   */
  @Prop() readonly: ITextField.readonly = false;

  /**
   * Determines if the text field is hidden from screen readers. Default: false
   */
  @Prop() isHidden: ITextField.isHidden = false;

  /**
   * Options required for the typeahead menu
   */
  @Prop() typeAheadOptions: ITextField.typeAheadOptions = [];

  /**
   * Accessible Title of the accessory icon
   */
  @Prop({ reflect: true }) accessoryAccessibleTitle: ITextField.accessoryAccessibleTitle = '';

  /**
   * Accessible Title of the helper text
   */
  @Prop({ reflect: true }) helperTextTitle = 'Character limit';

  /**
   * Accessible Title of the exceeded helper text
   */
  @Prop({ reflect: true }) helperTextExceededTitle = 'Character limit exceeded by';

  /**
   * Disable focus for accessory icon
   */
  @Prop({ reflect: true }) disableFocusForAccessoryIcon: ITextField.disableAccessoryIcon = false;

  /**
   * To show a custom message when there is no matching result found.
   */
  @Prop({ reflect: true }) noMatchFoundMessage: ITextField.noMatchFoundMessage = 'No matches found';

  /**
   * Determines if to show the icon to clear contents of the field. Default: false
   */
  @Prop() showClearButton: ITextField.showClearButton = false;

  /**
   * Should we show the password reveal icon ? Default: false
   */
  @Prop() showPasswordRevealIcon: ITextField.showPasswordRevealIcon = false;

  /**
   * Determines if the text field is required or not
   */
  @Prop() required: ITextField.required = false;

  /**
   * Pattern required by the text field
   */
  @Prop() pattern: ITextField.pattern;

  /**
   * Minimum length required for the text field
   */
  @Prop() minLength: ITextField.minLength;

  /**
   * Maximum length allowed for the text field. This won't restrict the character input by default. If you want to restrict character input set `enforceMaxLength` to true
   */
  @Prop() maxLength: ITextField.maxLength;

  /**
   * This will restrict the character entry once max length is reached.
   */
  @Prop({ reflect: true }) enforceMaxLength: ITextField.enforceMaxLength = false;

  /**
   * Strings for internal validations
   */
  @Prop({ reflect: true }) internalValidationStrings: ITextField.internalValidationStrings = internalValidationStrings;

  /**
   * Set the tab-index value
   */
  @Prop({ reflect: true }) tabIndexValue = '0';

  /**
   * Disable all internal validations and take control of validations
   */
  @Prop() noValidate: ITextField.noValidate = false;

  /**
   * This will be true when the control is in an invalid state. Validity is determined by props such as,
   * `required`, `minlength`, `maxLength` and `pattern` and custom validations
   */
  @Prop({ reflect: true, mutable: true }) invalid: ITextField.invalid = false;

  /**
   * Determines whether to show helper text or not. Default: false
   */
  @Prop() showHelperText: ITextField.showHelperText = false;

  /**
   * Determines whether to show place holder text or not. Default: '';
   */
  @Prop() placeHolderText: ITextField.placeHolderText = '';

  /**
   * Determines if the text field is in loading state. Default: false
   */
  @Prop() isLoading: ITextField.isLoading = false;

  /**
   * Determines type ahead filtering is to done from server side
   */
  @Prop() serverSideFiltering: ITextField.serverSideFiltering = false;

  /**
   * Determines the valid and invalid state of the text field
   */
  @Prop({ mutable: true }) fieldValidationState: ITextField.fieldValidationState = { status: 'valid' };

  /**
   * String containing the name of the accessory icon if required. Default -> ''
   */
  @Prop() accessoryIcon: ITextField.accessoryIcon = '';

  /**
   * Debounce the onchange call as and when required, The value specified should be in milliseconds
   */
  @Prop() debounce: ITextField.debounce = 0;

  /**
   * Separator which triggers formation of tokens from the text in input fields in tokenised variations. Default: 'Enter'
   */
  @Prop() separator: ITextField.separator = 'Enter';

  /**
   * To hide the multidimensional validation panel on focus. Default false.
   */
  @Prop({ reflect: true }) hideValidationPanelOnFocus = false;

  /**
   * This will be true when the text-field is a child of the selector to handle typeahead suggestion logic.
   */
  @Prop() isChildOfSelector: ITextField.isChildOfSelector = false;

  /**
   * Helper info text for the Voiceover
   */
  @Prop({ reflect: true }) helpInfo: ITextField.helpInfo;

  /**
   * Stores the open/close state of typeahead menu
   */
  @State() open = false;

  /**
   * Internal state to store if the text field has focus
   */
  @State() hasFocus = false;

  /**
   * Size of the spinner
   */
  @Prop() spinnerSize: ITextField.spinnerSize;

  /**
   * Description associated with the text fields which will be attached to aria-describedby. It is used for screen readers only
   */
  @Prop() ariaDescription: ITextField.ariaDescription = '';

  /**
   * Enable this option to prevent the panel from being clipped when the component is placed inside a container with overflow: auto|scroll.
   */
  @Prop({ reflect: true }) hoist: ITextField.hoist = false;

  /**
   * This is used to show the magnifying glass icon in the text field. This is set to true by default for search variation
   */
  // eslint-disable-next-line @stencil/strict-mutable
  @Prop({ reflect: true, mutable: true }) showSearchIcon: ITextField.showSearchIcon = false;

  /**
   * Enable drag and drop feature
   */
  @Prop() enableDraggableTokens: ITextField.enableDraggableTokens = false;

  /**
   * @deprecated this property will be removed in v4.0 and replaced with 'autocapitalize' (all lowercase) to match the native html attribute
   *
   * Controls whether and how text input is automatically capitalized as it is entered/edited by the user. Default: 'off'
   */
  @Prop() autoCapitalize: ITextField.autocapitalize = 'off';

  /**
   * Controls whether and how text input is automatically capitalized as it is entered/edited by the user. Default: 'off'
   */
  @Prop({ reflect: true }) autocapitalize = 'off';

  /**
   * @deprecated this property will be removed in v4.0 and replaced with 'autocomplete' (all lowercase) to match the native html attribute
   *
   * Controls whether and how text input is automatically Autocomplete as it is entered/edited by the user.
   */
  @Prop() autoComplete: ITextField.autocomplete;

  /**
   * Controls whether and how text input is automatically Autocomplete as it is entered/edited by the user.
   */
  @Prop({ reflect: true }) autocomplete: ITextField.autocomplete;

  /**
   * @deprecated this property will be removed in v4.0 and replaced with 'spellcheck' (all lowercase) to match the native html attribute
   *
   * To enable browser's spell check for the entered text.
   */
  @Prop() spellCheck: ITextField.spellcheck;

  /**
   * To enable browser's spell check for the entered text.
   */
  @Prop({ reflect: true }) spellcheck: ITextField.spellcheck;

  /**
   * @deprecated this property will be removed in v4.0 as it is a non-standard attribute. Use 'spellcheck' instead.
   *
   * Controls whether and how text input is automatically Auto correct  as it is entered/edited by the user.
   */
  @Prop() autoCorrect: ITextField.autocorrect = 'off';

  /**
   * Enable the instant revalidation
   */
  @Prop({ reflect: true }) enableInstantRevalidation = true;

  /**
   * Prop to enable/disable Typeahead feature, Default: false.
   */
  @Prop() disableTypeaheadText: ITextField.disableTypeaheadText = false;
  /**
   * Mask pattern to define the input format.
   * Example: "(###) ###-####" for phone numbers.
   * Can include special characters like `#` (numeric), `A` (alphabetic), and `*` (any character).
   */
  @Prop() maskPattern: ITextField.maskPattern = '';

  /**
   * Placeholder character for unfilled positions in the input mask.
   * Default: '_'.
   * Example: "(###) ###-####" with `_` will show "(___) ___-____".
   */
  @Prop() placeHolderChar: ITextField.placeHolderChar = '_';

  /**
   * Restricts input to characters that match the mask pattern.
   * If `true`, invalid characters will be ignored while typing.
   * Default: `true`.
   */
  @Prop() restrictInput: ITextField.restrictInput = true;

  /**
   * Specifies the mask type for predefined patterns.
   * Supported values: `credit-card`, `phone-number`, `zip-code`, `month-date`, etc.
   * Automatically applies a default `maskPattern` for the selected type.
   */
  @Prop() maskType: ITextField.maskType = '';

  private get browserInputProperties() {
    const spellcheck = `${this.spellcheck ?? this.spellCheck ?? (this.autoCorrect === 'on' ? true : false)}` !== 'false';
    const autocorrect = spellcheck ? 'on' : 'off';
    return {
      spellcheck,
      autocorrect,
      autocomplete: this.autocomplete || this.autoComplete || null,
      autocapitalize: this.autocapitalize || this.autoCapitalize || 'off'
    };
  }

  /**
   * whether to show menu options in multiple lines for typeahead text field. Default false.
   */
  @Prop({ attribute: 'multi-line', reflect: true, mutable: true }) isMultiLine: ITextField.isMultiLine = false;

  /**
   * Specifies the visible number of lines in a text area
   */
  @Prop() rows: ITextField.rows = 2;

  /**
   * Specifies the visible width of a text area
   */
  @Prop() cols: ITextField.cols = 20;

  /**
   * Whether to show internal validations in multi dimensional. Default false.
   */
  @Prop({ reflect: true }) showInternalValidationsInMultiDimensionalTooltip = false;

  /**
   * Position dialog opens in
   */
  @Prop({ reflect: true }) position: ITextField.position = 'above';

  /**
   * Show the close icon for tokens
   */
  @Prop({ reflect: true }) showCloseIconForTokens = false;

  /**
   * Enable add new option when there are no matches found. Default --> false.
   */
  @Prop({ reflect: true }) enableAddNewOption = false;

  /**
   * `preventInput` will work based on the `pattern` prop, if the user given `pattern` is not matched then it will prevent typing on the input. Default --> false.
   */
  @Prop({ reflect: true }) preventInput = false;

  /**
   * Prevent duplicate tokens. Default --> false.
   */
  @Prop({ reflect: true }) preventDuplicateTokens = false;

  /**
   * Prevent creating the new tokens. Default --> false.
   */
  @Prop({ reflect: true }) preventCreateNewTokens = false;

  /**
   * Emitted when the value of the text field changes
   */
  @Event() bricksTextFieldChange: EventEmitter<ITextField.Events.Detail.TextFieldChange>;

  /**
   * Emitted when the last item is visible into view
   */
  @Event() bricksTextFieldMenuScroll: EventEmitter<ITextField.Events.Detail.TextFieldLastItem>;

  /**
   * Emitted when the value of the typeahead text field is selected from menu
   */
  @Event() bricksTextFieldTypeaheadSelect: EventEmitter<ITextField.Events.Detail.TextFieldTypeaheadSelect>;

  /**
   * Emitted when the users types in the input field
   */
  @Event() bricksTextFieldInput: EventEmitter<ITextField.Events.Detail.TextFieldInput>;

  /**
   * Emitted when the text field attains focus
   */
  @Event() bricksTextFieldFocus: EventEmitter<ITextField.Events.Detail.TextFieldFocus>;

  /**
   * Emitted when the text field loses focus
   */
  @Event() bricksTextFieldBlur: EventEmitter<ITextField.Events.Detail.TextFieldBlur>;

  /**
   * Emitted when there is a keyup event on the input element
   */
  @Event() bricksTextFieldKeyup: EventEmitter<ITextField.Events.Detail.TextFieldKeyup>;

  /**
   * Emitted when accessory icon is clicked
   */
  @Event() bricksTextFieldAccessoryIconClick: EventEmitter<ITextField.Events.Detail.TextFieldAccessoryIconClick>;

  /**
   * Emitted when add new option is clicked
   */
  @Event() bricksTextFieldAddNewOptionClick: EventEmitter<ITextField.Events.Detail.TextFieldAddNewOptionClick>;

  /**
   * Emitted when clear icon is clicked
   */
  @Event() bricksTextFieldClearIconClick: EventEmitter<ITextField.Events.Detail.TextFieldClearIconClick>;

  /**
   * Emitted when enter is pressed in a text field with search icon
   */
  @Event() bricksTextFieldEnter: EventEmitter<ITextField.Events.Detail.TextFieldEnter>;

  /**
   * Emitted when token is removed using keyboard or mouse
   */
  @Event() bricksTextFieldTokenRemove: EventEmitter<ITextField.Events.Detail.TextFieldTokenRemove>;

  /**
   * Emitted when token is added using keyboard or mouse
   */
  @Event() bricksTextFieldTokenAdd: EventEmitter<ITextField.Events.Detail.TextFieldTokenAdd>;

  /**
   * Stores the target index for tokens
   */
  private targetIndex = 0;

  /**
   * Checking if tokenisedValues are updated or not after dropping the token
   */
  private isTokensUpdated = false;

  /**
   * Stores the copy of TypeAheadOptions
   */
  private tokenizedTypeAheadOptions: ITextField.TypeAheadOption[] = [];

  private elTextField: HTMLInputElement | HTMLTextAreaElement;

  /**
   * Value to be emitted for the text field bricksTextFieldChange event.
   */
  private valueToEmit: string | string[] = '';

  /**
   * Stores the typeahead suggestion value
   */
  private typeaheadValue = '';

  /**
   * Element Reference to accessoryicon slot
   */
  private hasAccessoryIconSlot: HTMLElement;

  /**
   * Emits bricksTextFieldChange event
   * @param args Arguments to be passed to the event emitter
   */
  private emitChangeEvent = (...args) => {
    this.bricksTextFieldChange.emit(...args);
  };

  /**
   * Emits bricksTextFieldChange event KeyboardEvent
   * @param event OnInput
   */
  handleTextFieldChange = debounce(this.emitChangeEvent, this.debounce);

  @Watch('debounce')
  debounceChanged() {
    this.handleTextFieldChange = debounce(this.emitChangeEvent, this.debounce);
  }

  /**
   * Watcher for change in typeahead option
   */
  @Watch('typeAheadOptions')
  handleTypeAheadOptionsChange() {
    this.visibleOptions = this.typeAheadOptions;
  }

  @Watch('variation')
  handleVariationChange() {
    if (this.variation === SEARCH) {
      this.showSearchIcon = true;
    }
  }

  /**
   * Watcher for change in value
   */
  @Watch('value')
  handleValueChange() {
    if (this.variation === TOKENISED) {
      if (Array.isArray(this.value)) {
        this.tokenisedValues = [...this.value];
      }
      if (this.tokenisedValues.length) {
        this.elTextField && (this.elTextField.style.width = `${this.elTextField.value.length + 4}ch`);
      } else {
        this.elTextField?.removeAttribute('style');
      }
    }
    if ((this.variation === 'typeahead' && !this.disableTypeaheadText && !this.isMultiLine) || this.isChildOfSelector) {
      this.typeaheadValue = TypeaheadSuggestion(this.value, this.elTypeaheadInput, this.visibleOptions, this.disableTypeaheadText);
      if (!!this.typeaheadValue && this.elTypeaheadInput) {
        this.elTypeaheadInput.value = this.typeaheadValue;
      }
      if (!this.isChildOfSelector && !!this.elTypeaheadInput && !!this.value && !!this.typeaheadValue) {
        const inputTextWidth = this.calculateTextWidth(this.value);
        writeTask(() => {
          this.elTypeaheadInput.value = inputTextWidth > this.elInput.getBoundingClientRect().width ? '' : this.typeaheadValue;
        });
      }
    }
    if (this.showInternalValidationsInMultiDimensionalTooltip) {
      this.updateInternalFieldValidationState();
    }
    // For the password field checking the value length is 1 setting accessoryAccessibleTitle to 'Show Password' and for value length 0 setting it to empty string.
    if (this.variation === SECURE && this.showPasswordRevealIcon && !this.accessoryIcon) {
      if (this.value.length === 1) {
        this.accessoryAccessibleTitle = 'Show Password';
      } else if (this.value.length === 0) {
        this.accessoryAccessibleTitle = '';
      }
    }
  }

  @Watch('open')
  handleOpenChange() {
    this.elTextField.setAttribute('aria-expanded', `${this.open.toString()}`);
  }

  @Watch('fieldValidationState')
  handleFieldValidationStateChange() {
    if (!this.fieldValidationState) return;
    const isSingleFieldValidation = this.isSingleFieldValidation(this.fieldValidationState);
    if (isSingleFieldValidation) {
      this.invalid = (this.fieldValidationState as ITextField.ValidationState)?.status === 'invalid';
    } else {
      const errorStates = (this.fieldValidationState as ITextField.MultiValidationState).validations.filter(validation => validation.state === 'invalid');
      this.invalid = errorStates && errorStates.length ? true : false;
    }
  }

  @Watch('maskPattern')
  validateMaskPattern(newPattern: string) {
    const invalidPattern = /[^#A*]/;
    if (invalidPattern.test(newPattern)) {
      console.log('Invalid');
      throw new Error(`Invalid mask pattern`);
    }
  }

  /**
   * Set focus on the input element
   */
  @Method()
  async setFocus() {
    writeTask(() => {
      this.handleInputFocus();
    });
  }

  /**
   * Set blur on the input element
   */
  @Method()
  async setBlur() {
    this.handleInputBlur();
  }

  /**
   * Open the typeahead menu. Especially used in serverSideFiltering
   */
  @Method()
  async openTypeAheadMenu() {
    this.elTypeAheadMenuButton?.show();
    this.open = true;
  }

  /**
   * Close the typeahead menu. Especially used in serverSideFiltering
   */
  @Method()
  async closeTypeAheadMenu() {
    this.elTypeAheadMenuButton?.hide();
    this.open = false;
  }

  /**
   * Fetch all tokenised values in a tokenised field
   */
  @Method()
  async getTokenisedValues() {
    return this.tokenisedValues;
  }

  /**
   * Select text inside of an input
   */
  @Method()
  async setSelect(selectionStart: number | null, selectionEnd: number | null, direction?: 'forward' | 'backward' | 'none') {
    this.elInput.focus();
    this.elInput.setSelectionRange(selectionStart ?? 0, selectionEnd ?? this.value.length, direction);

    return {
      selectionStart: this.elInput.selectionStart,
      selectionEnd: this.elInput.selectionEnd,
      selectionDirection: this.elInput.selectionDirection
    };
  }

  connectedCallback() {
    this.hasPrefixIconSlot = !this.showSearchIcon && this.variation !== 'search' && hasSlot(this.elHost, 'prefix-icon');
  }

  componentWillLoad() {
    this.isMultiLine = this.isMultiLine && this.variation === TYPE_AHEAD ? true : false;
    this.visibleOptions = this.typeAheadOptions;
    this.tokenizedTypeAheadOptions = deepCopy(this.typeAheadOptions);
    if (this.variation === TOKENISED) {
      this.tokenisedValues = Array.isArray(this.value) ? [...this.value] : [];
    }
    this.handleVariationChange();
    this.handleFieldValidationStateChange();
    this.hasAccessoryIconslot = this.elHost.querySelector('[slot="accessory-icon"]') as HTMLSlotElement;
    this.inheritedAttributes = inheritAriaAttributes(this.elHost);
    this.inheritedDataAttributes = inheritDataAttributesFromHost(this.elHost);
    this.hasAccessoryIconSlot = this.elHost.querySelector('[slot="accessory-icon"]') as HTMLSlotElement;
    writeTask(() => {
      if (this.visualStyle === 'default') {
        this.elLabel.classList.add('visible-to-screen-readers-only');
      }
    });
  }

  componentDidRender() {
    writeTask(() => {
      this.resizeMenuAsPerSelectorWidth();
    });
  }

  componentDidLoad() {
    this.elTextField = this.isMultiLine ? this.elTextArea : this.elInput;
    if ((this.variation === TOKENISED && this.typeAheadOptions.length) || this.variation === TYPE_AHEAD) {
      this.elTextField.setAttribute('role', 'combobox');
      this.elTextField.setAttribute('aria-haspopup', 'listbox');
      this.elTextField.setAttribute('aria-expanded', 'false');
    }
    if (this.variation === SEARCH) {
      this.elTextField.setAttribute('role', 'searchbox');
    }
    this.debounceChanged();
    if (!this.fieldValidationState) return;
    if (!this.isSingleFieldValidation(this.fieldValidationState) && this.fieldValidationState?.validations.length) {
      this.updatePopoverInstance();
    }
    if (this.showInternalValidationsInMultiDimensionalTooltip) {
      this.createInternalFieldValidationsArray();
    }
    // Setting accessoryAccessibleTitle on initial load when the text field has a value
    if (this.variation === SECURE && this.showPasswordRevealIcon && this.value && !this.accessoryIcon) {
      this.accessoryAccessibleTitle = 'Show Password';
    }
  }

  /**
   * Create internal field validations array
   */
  private createInternalFieldValidationsArray = () => {
    const internalValidationObj = [{ required: this.required }, { minLength: this.minLength }, { maxLength: this.maxLength }, { pattern: this.pattern }];
    internalValidationObj.forEach(element => {
      const validationAttr = Object.keys(element).toString();
      if (element[validationAttr]) {
        const validationFieldObj: ITextField.Validation = {
          state: 'neutral',
          message:
            element.required || element.pattern
              ? internalValidationStrings[validationAttr]
              : element.maxLength
                ? internalValidationStrings.maxLength(this.maxLength)
                : internalValidationStrings.minLength(this.minLength),
          type: validationAttr as keyof ITextField.internalValidationStrings
        };
        this.internalValidationStateArray.push(validationFieldObj);
      }
    });
  };

  /**
   * Update internal field validation state info on value change
   */
  private updateInternalFieldValidationState = () => {
    this.setInternalValidationStates();
    const validationAttr = this.handleInternalValidation();
    this.internalValidationStateArray &&
      this.internalValidationStateArray.forEach(element => {
        element.state = validationAttr[element?.type] ? 'invalid' : 'valid';
      });
  };

  /**
   * Store the tokenizedTypeAheadOptions in visibleOptions
   */
  private visibleTokenizedTypeAheadOptions = () => {
    this.visibleOptions = deepCopy(this.tokenizedTypeAheadOptions);
  };

  /**
   * Resize typeahead menu as per width of the host element
   */
  private resizeMenuAsPerSelectorWidth = () => {
    this.elMenu && (this.elMenu.style.width = window.getComputedStyle(this.elHost).getPropertyValue('width'));
  };

  /**
   * Get all the tokens generated in case of multiple selection.
   */
  private getTokens = () => {
    const tokens = this.elBase.querySelectorAll('bricks-token');
    return tokens;
  };

  /**
   * Update/Create the FloatingUI instance
   */
  private updatePopoverInstance = () => {
    if (this.popper) {
      this.popper.destroy();
    }

    const placement = this.position === 'auto' ? 'vertical' : this.position;
    this.popper = new Popper(this.elBase, this.elTooltip, {
      strategy: this.hoist ? 'fixed' : 'absolute',
      distance: 10,
      placement,
      fallBackPlacements: ['bottom-start'],
      transitionElement: this.elTooltip,
      arrow: this.arrow,
      arrowOptions: {
        staticOffset: 15
      }
    });
  };

  /**
   * Set Active Token
   * @param token HTMLBricksTokenElement
   */
  private setActiveToken = (token: HTMLBricksTokenElement) => {
    token.setFocus();
  };

  /**
   * Emits bricksTextFieldChange event onInput
   * @param event OnInput
   */
  private handleOnInputChange = event => {
    if ((this.variation === TYPE_AHEAD || this.variation === TOKENISED) && !this.serverSideFiltering) {
      const options = this.variation === TOKENISED ? this.tokenizedTypeAheadOptions : this.typeAheadOptions;
      const optionsToShow = options.filter(option => option && option.label?.toLowerCase().trim().includes(event.target.value.toLowerCase().trim()));
      this.visibleOptions = [...optionsToShow];
    }
    this.visibleOptions.length ? this.openTypeAheadMenu() : this.closeTypeAheadMenu();
    this.value = event.target.value;
    if (this.showHelperText) {
      this.updateLiveRegionForHintText();
    }
    if (
      !this.noValidate &&
      ((this.enableInstantRevalidation && this.internalFieldValidationState.status === 'invalid') ||
        (this.enableInstantRevalidation && this.fieldValidationState['status'] === 'invalid'))
    ) {
      this.setInternalValidationStates();
    }
    if (this.variation === TOKENISED) {
      const values = [...this.tokenisedValues, event.target.value];
      this.handleTextFieldChange({ event, context: this, element: this.elHost, value: values });
      this.bricksTextFieldInput.emit({ event, context: this, element: this.elHost, value: values });
      return;
    }
    if (this.hideValidationPanelOnFocus && this.value.length > 0) {
      this.elTooltip?.classList.add('visible');
    }
    if (this.popper) {
      this.popper.show();
    }
    if (this.restrictInput && (this.maskPattern || this.maskType)) {
      console.log('hello');
      this.maskedValue = this.applyMask(event.target.value);
      event.target.value = this.maskedValue;

      this.bricksTextFieldChange.emit({
        event,
        element: this.elHost,
        context: this,
        value: this.maskedValue
      });
    }
    console.log(this.maskedValue, 'this.maskedValue in handleOnInputChange...');
    this.handleTextFieldChange({ event, context: this, element: this.elHost, value: event.target.value });
    this.bricksTextFieldInput.emit({ event, context: this, element: this.elHost, value: event.target.value });
  };

  /**
   * Handle focus on the input element
   */
  private handleInputFocus = (event?: FocusEvent) => {
    if (!this.hasFocus) {
      writeTask(() => {
        this.typeaheadValue = this.elTypeaheadInput?.value;
      });
      if (this.variation === TYPE_AHEAD && this.elTypeaheadInput) {
        this.elTypeaheadInput.style.display = 'block';
      }
      if (this.variation === TOKENISED) {
        this.elBase.classList.add('base--focus');
        if (this.allTokensSelected) {
          this.handleTokenActiveState(false);
        }
      }
      this.elTextField?.focus();
      this.handleFocusin();
      if (!this.hideValidationPanelOnFocus || this.value.length > 0) {
        this.elTooltip?.classList.add('visible');
      }

      if (this.showHelperText) {
        this.updateLiveRegionForHintText();
      }
      if (this.popper) {
        this.popper.show();
      }
      if (event?.type !== 'focus') return;
      if (this.elTypeaheadInput) {
        this.elTypeaheadInput.style.display = 'none';
      }
      this.bricksTextFieldFocus.emit({ event, context: this, element: this.elHost, value: this.value as string });
    }
  };

  /**
   * Hanlde blur on the input element
   */
  private handleInputBlur = (event?: FocusEvent) => {
    if (this.variation === TYPE_AHEAD && this.elTypeaheadInput) {
      this.elTypeaheadInput.style.display = 'none';
    }
    if (this.variation === TOKENISED) {
      this.elBase.classList.remove('base--focus');
      if (this.allTokensSelected) {
        this.handleTokenActiveState(false);
      }
    }
    this.handleFocusout();
    this.elTooltip?.classList.remove('visible');
    if (this.popper) {
      this.popper.hide();
    }

    if (!this.noValidate) {
      this.setInternalValidationStates();
    }
    this.bricksTextFieldBlur.emit({ event, context: this, element: this.elHost, value: this.value as string });
  };

  /**
   * Setting internal validation states on blur.
   */
  private setInternalValidationStates = () => {
    const validationState: ITextField.ValidationState = { ...this.internalFieldValidationState, status: 'invalid', showIcon: true };
    const validationAttr = this.handleInternalValidation();
    if (validationAttr.required) {
      this.invalid = true;
      validationState.message = this.internalValidationStrings.required;
    } else if (validationAttr.pattern) {
      this.invalid = true;
      validationState.message = this.internalValidationStrings.pattern;
    } else if (validationAttr.minLength || validationAttr.maxLength) {
      this.invalid = true;
      validationState.message =
        this.value.length < this.minLength ? this.internalValidationStrings.minLength(this.minLength) : this.internalValidationStrings.maxLength(this.maxLength);
    } else {
      this.invalid = false;
      validationState.message = '';
      validationState.status = 'valid';
      validationState.showIcon = false;
    }
    this.internalFieldValidationState = { ...validationState };
  };

  private applyMask(input: string): string {
    // Default mask patterns for US input types
    const predefinedMaskTypes: { [key: string]: string } = {
      'credit-card': '#### #### #### ####',
      'phone-number': '(###) ###-####',
      'zip-code': '#####-####',
      ssn: '###-##-####',
      'license-plate': 'AAA-####',
      'date-mmddyyyy': '##/##/####',
      'date-ddmmyyyy': '##/##/####',
      'time-hhmm': '##:##',
      ip: '###.###.###.###',
      mac: '##:##:##:##:##:##'
    };

    let maskedInput = '';
    let patternIndex = 0;
    let inputIndex = 0;

    const maskRules = {
      '#': /\d/, // Numeric characters only
      A: /[a-zA-Z]/, // Alphabetic characters only
      '*': /./ // Any character
    };

    const activePattern = this.maskType && predefinedMaskTypes[this.maskType] ? predefinedMaskTypes[this.maskType] : this.maskPattern;

    while (patternIndex < activePattern.length && inputIndex < input.length) {
      const maskChar = activePattern[patternIndex];
      const inputChar = input[inputIndex];

      if (maskRules[maskChar]) {
        if (maskRules[maskChar].test(inputChar)) {
          maskedInput += inputChar;
          inputIndex++;
        } else if (this.restrictInput) {
          return maskedInput; // Stop adding invalid characters
        }
      } else {
        // Add literal characters from the mask (e.g., hyphens, slashes)
        maskedInput += maskChar;
        if (inputChar === maskChar) inputIndex++;
      }
      patternIndex++;
    }

    while (patternIndex < activePattern.length) {
      maskedInput += maskRules[activePattern[patternIndex]] ? this.placeHolderChar : activePattern[patternIndex];
      patternIndex++;
    }

    return maskedInput;
  }

  /**
   * Checks whether text field supports field validation or not based on its variation.
   * @returns
   */ inputVariationsSupportingFieldValidation = () => {
    return ['standard', 'secure', 'search'].includes(this.variation);
  };

  /**
   * Handle generic internal validations like `required`, `pattern`, `minLength`, `maxLength`
   * @returns validation object
   */
  handleInternalValidation = () => {
    const regex = new RegExp(this.pattern);
    const hasValidationSupport = this.inputVariationsSupportingFieldValidation();
    const isRequired = this.required && !(this.value.length || (this.variation === 'tokenised' && this.tokenisedValues.length));
    const isPattern = this.pattern && (hasValidationSupport || this.variation === 'tokenised') && this.value.length && !regex.test(this.value as string);
    const isMin = this.minLength && hasValidationSupport && this.value.length < this.minLength;
    const isMax = this.maxLength && hasValidationSupport && this.value.length > this.maxLength;
    return { required: isRequired, pattern: isPattern, minLength: isMin, maxLength: isMax };
  };

  /**
   * Handle selection from menu in typeahead
   * @param event CustomEvent. BricksMenuItem type
   */
  private handleMenuSelection = (event: CustomEvent) => {
    const menuItem = event.detail.value;

    const optionMatchingValue = menuItem.value && this.typeAheadOptions.find(option => option.value === menuItem.value);
    const selectedOption =
      optionMatchingValue ??
      this.typeAheadOptions.find(option => option.label.trim() === (option.subtitle ? menuItem.textContent.split(option.subtitle)[0].trim() : menuItem.textContent.trim()));
    if (this.variation === TYPE_AHEAD) {
      this.value = this.showSubtitleInSelectedText && selectedOption.subtitle ? `${selectedOption.label} - ${selectedOption.subtitle}` : selectedOption.label;
      this.visibleOptions = this.typeAheadOptions;
      this.valueToEmit = selectedOption.value;
      this.bricksTextFieldTypeaheadSelect.emit({ event, context: this, element: this.elHost, value: this.valueToEmit, meta: selectedOption });
    } else if (this.variation === TOKENISED) {
      this.tokenisedValues = [...this.tokenisedValues, selectedOption.label];
      this.elTextField.value = '';
      const textContent = selectedOption.label?.toLowerCase();
      const textContentIndex = this.tokenizedTypeAheadOptions.findIndex(item => item.label?.toLowerCase() === textContent);
      if (textContentIndex > -1) {
        this.tokenizedTypeAheadOptions.splice(textContentIndex, 1);
      }
      this.visibleTokenizedTypeAheadOptions();

      this.value = [...this.tokenisedValues];

      this.valueToEmit = [...this.valueToEmit, selectedOption.value];

      this.handleBaseScroll();
      this.bricksTextFieldTokenAdd.emit({ event, context: this, element: this.elHost, value: this.value, meta: selectedOption });
    }
    this.handleTextFieldChange({ event, context: this, element: this.elHost, value: this.valueToEmit, meta: selectedOption });
  };

  /**
   * Emitting event when the last item is visible into view
   */
  private handleMenuScroll = event => {
    const dropdown = this.elMenu.shadowRoot.querySelector('.menu');
    if (dropdown.scrollTop + dropdown.clientHeight >= dropdown.scrollHeight) {
      this.bricksTextFieldMenuScroll.emit({ event });
    }
  };

  /**
   * Keydown on input so that a11y rules can be handled on the typeahead
   * @param event Keyboard Event
   */
  private handleInputKeyDown = event => {
    setTimeout(() => {
      if ((event.key === 'Escape' || event.key === 'ArrowDown') && this.elTypeaheadInput) {
        this.elTypeaheadInput.style.display = 'none';
      }
      if (
        ((this.variation === TYPE_AHEAD && !this.disableTypeaheadText && !this.isMultiLine) || this.isChildOfSelector) &&
        event.key === 'ArrowRight' &&
        this.elTypeaheadInput &&
        this.elTypeaheadInput?.style.display !== 'none' &&
        !this.readonly
      ) {
        setTypeaheadSuggestedValue(this.visibleOptions, this.elTypeaheadInput, this.typeaheadValue, this.elTextField);
        this.handleTextFieldChange({ event, context: this, element: this.elHost, value: this.elTypeaheadInput?.value });
      }
    }, 100);
    if (this.variation === TYPE_AHEAD || this.variation === TOKENISED) {
      const menuItems = this.elMenu.querySelectorAll('bricks-menu-item');
      if (menuItems.length) {
        const activeMenuItems = [...menuItems].filter(item => !item.hasAttribute('disabled'));
        const firstMenuItem = activeMenuItems[0];
        const lastMenuItem = activeMenuItems.at(-1);

        if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
          this.openTypeAheadMenu();
          if (event.key === 'ArrowDown') {
            writeTask(() => {
              firstMenuItem.setFocus();
            });
          } else if (event.key === 'ArrowUp') {
            writeTask(() => {
              lastMenuItem.setFocus();
            });
          }
        }
        if (['Escape'].includes(event.key)) {
          writeTask(() => {
            if (this.elTypeaheadInput) {
              this.elTypeaheadInput.style.display = 'none';
            }
          });
          this.closeTypeAheadMenu();
        }
      }
    } else {
      if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
        if (event.key === 'ArrowUp') {
          this.elTextField.setSelectionRange(0, 0);
          return;
        } else if (event.key === 'ArrowDown') {
          this.elTextField.setSelectionRange(this.elTextField.value.length, this.elTextField.value.length);
          return;
        }
      }
    }
    if (this.variation === TOKENISED) {
      const isSeparatorArray = Array.isArray(this.separator);
      if (
        event.target.value.trim().length > 0 &&
        ((typeof this.separator === 'string' && event.key === this.separator) || (isSeparatorArray && this.separator.includes(event.key)))
      ) {
        writeTask(() => {
          const validationAttr = this.handleInternalValidation();
          this.updateInternalFieldValidationState();
          if (validationAttr.pattern) return;
          let keyValue;
          if (isSeparatorArray) {
            if (this.separator?.length > 0) {
              const index = this.separator?.indexOf(event.key);
              if (index > -1) {
                keyValue = this.separator[index];
              }
            }
          }
          const inputTextValue = this.elInput.value?.replace(keyValue ? keyValue : this.separator, '');
          this.createNewTokens(inputTextValue);
          const textContent = inputTextValue?.toLowerCase();
          const textContentIndex = this.tokenizedTypeAheadOptions.findIndex(item => item.label?.toLowerCase() === textContent);
          const selectedTokenObj = this.tokenizedTypeAheadOptions[textContentIndex];
          if (textContentIndex > -1) {
            this.tokenizedTypeAheadOptions.splice(textContentIndex, 1);
          }
          this.visibleTokenizedTypeAheadOptions();
          this.value = [...this.tokenisedValues];
          this.handleBaseScroll();
          this.handleTextFieldChange({ event, context: this, element: this.elHost, value: this.value, meta: selectedTokenObj });
          this.bricksTextFieldTokenAdd.emit({ event, context: this, element: this.elHost, value: event.target.value as string, meta: selectedTokenObj });
        });
      }
    }
    if (event.key === 'Enter') {
      if (!this.noValidate) {
        this.setInternalValidationStates();
      }
      this.bricksTextFieldEnter.emit({ event, context: this, element: this.elHost, value: this.value as string });
    }
  };

  /**
   * Creating the new tokens
   * @param inputTextValue string
   */
  private createNewTokens(inputTextValue: string) {
    if (this.preventCreateNewTokens) {
      this.tokenisedValues = [...this.tokenisedValues];
    } else if (!this.preventDuplicateTokens) {
      this.tokenisedValues = [...this.tokenisedValues, inputTextValue];
      this.elTextField.value = '';
    } else {
      if (!this.tokenisedValues.includes(inputTextValue.trim())) {
        this.tokenisedValues = [...this.tokenisedValues, inputTextValue];
        this.elTextField.value = '';
      } else {
        this.tokenisedValues = [...this.tokenisedValues];
      }
    }
  }

  /**
   * Handle keypress on the input element
   */
  private handleInputKeyPress = event => {
    if (event.metaKey && event.key === 'v') return;
    if (this.pattern && this.preventInput) {
      const regex = new RegExp(this.pattern);
      if (!regex.test(this.value + event.key)) {
        event.preventDefault();
      }
    }
  };

  /**
   * Handles token creation on paste
   */
  private handlePaste = event => {
    if (this.pattern && this.preventInput) {
      const regex = new RegExp(this.pattern);
      if (!regex.test(event?.clipboardData?.getData('text'))) {
        event.preventDefault();
      }
    }

    if (this.variation === 'tokenised') {
      const pasteData = event?.clipboardData?.getData('text');
      if (
        (!Array.isArray(this.separator) && !pasteData.includes(this.separator)) ||
        (Array.isArray(this.separator) && !this.separator?.some(substring => pasteData.includes(substring)))
      ) {
        return;
      } else {
        event.preventDefault();
        if (Array.isArray(this.separator)) {
          const filteredArray = this.separator.reduce(
            (pastedData, separatorKey) => {
              return pastedData.flatMap(subStr => subStr.split(separatorKey));
            },
            [pasteData]
          );
          const tokensArray = this.separator.length > 0 && filteredArray;
          this.renderValues(tokensArray);
        } else {
          const tokensArray = pasteData?.split(this.separator);
          this.renderValues(tokensArray);
        }

        this.bricksTextFieldTokenAdd.emit({ event, context: this, element: this.elHost, value: this.value });
      }
    }
  };

  /**
   * Renders value array from tokensArray
   */
  private renderValues = tokensArray => {
    const trimmedArray = tokensArray.map(string => string.trim());
    this.value = [...this.value, ...trimmedArray];
    return this.value;
  };

  /**
   * Handle keyup on the input element
   */
  private handleInputKeyUp = event => {
    writeTask(() => {
      if (((this.variation === TYPE_AHEAD && !this.isMultiLine) || this.isChildOfSelector) && event.key === 'Tab' && this.typeaheadValue) {
        setTypeaheadSuggestedValue(this.visibleOptions, this.elTypeaheadInput, this.typeaheadValue, this.elTextField);
        this.handleTextFieldChange({ event, context: this, element: this.elHost, value: this.elTypeaheadInput?.value });
      }
    });
    this.bricksTextFieldKeyup.emit({ event, context: this, element: this.elHost, value: event.target.value as string });
  };

  /**
   * Handle scroll in the base field in tokeised variation
   */
  private handleBaseScroll = () => {
    setTimeout(() => {
      this.elBase.scrollTo({
        left: getElementDir() === 'rtl' ? -this.elBase.scrollWidth : this.elBase.scrollWidth,
        behavior: 'smooth'
      });
    }, 50); // NOTE: 50ms is based on trail and error testing to ensure smooth scrolling inside the tokenised field
  };

  /**
   * Handle setting the tokens as active/inactive
   * @param activeState Boolean
   * @returns
   */
  private handleTokenActiveState = (activeState: boolean) => {
    const tokens = this.getTokens();
    tokens.forEach(token => (token.active = activeState));
    this.allTokensSelected = activeState;
    return;
  };

  /**
   * Handle keydown on the base
   * @param event Keyboard Event
   * @returns
   */
  private handleBaseKeyDown = event => {
    if (this.variation === TOKENISED) {
      let index = -1;
      const tokens = this.getTokens();
      if (tokens && tokens.length && event.target.tagName.toLowerCase() === 'bricks-token') {
        const activeToken = [...tokens].filter(token => token.shadowRoot.querySelector('span[part="base"]').classList.contains('token--focused'))[0];
        index = activeToken && [...tokens].indexOf(activeToken);
        if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
          if (this.allTokensSelected) {
            event.stopPropagation();
            return;
          }
          if (event.key === 'ArrowLeft') index--;
          if (event.key === 'ArrowRight') index++;

          if (index < 0) index = tokens.length - 1;
          if (index > tokens.length - 1) {
            this.setFocus();
            this.elTextField.setSelectionRange(this.elTextField.value.length, this.elTextField.value.length);
            return;
          }

          this.setActiveToken(tokens[index]);
          event.stopPropagation();
        } else if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
          this.handleInputKeyDown(event);
          this.handleInputBlur();
        } else if (['Delete', 'Backspace'].includes(event.key) && activeToken) {
          this.handleRemoveToken(event, activeToken.tokenLabel);
        } else if (event.key === 'a' && event.metaKey) {
          if (tokens.length) {
            event.preventDefault();
            this.handleTokenActiveState(true);
          }
        }
      } else if (event.target.tagName.toLowerCase() === 'input' && tokens && tokens.length) {
        if (event.key === 'ArrowLeft' && event.target.selectionStart === 0 && event.target.selectionEnd === 0 && !this.allTokensSelected) {
          this.setActiveToken(tokens[tokens.length - 1]);
        } else if (event.key === 'ArrowRight' && event.target.selectionStart === event.target.value.length && !this.allTokensSelected) {
          this.setActiveToken(tokens[0]);
        } else if (event.key === 'Backspace' && event.target.selectionStart === 0 && event.target.selectionEnd === 0) {
          if (this.allTokensSelected) {
            this.handleClearAllTokens();
            event.stopPropagation();
            return;
          }
          this.setActiveToken(tokens[tokens.length - 1]);
        } else if (event.key === 'a' && event.metaKey && !this.elTextField.value) {
          if (tokens.length) {
            this.handleTokenActiveState(true);
          }
        }
      }
    }
  };

  /**
   * Handle token remove
   * @param event CustomEvent
   * @param tokenLabel token value
   * @returns
   */
  private handleRemoveToken = (event: CustomEvent, tokenLabel: string) => {
    if (this.readonly) return;
    const tokens = this.getTokens();
    const tokensDuplicate = [...this.tokenisedValues];
    if (this.allTokensSelected) {
      this.handleClearAllTokens();
      event.stopPropagation();
      return;
    }
    const indexToDelete = tokensDuplicate.findIndex(token => token === tokenLabel);
    tokensDuplicate.splice(indexToDelete, 1);
    this.tokenisedValues = [...tokensDuplicate];
    if (indexToDelete > 0 && indexToDelete === tokens.length - 1) {
      this.setActiveToken(tokens[indexToDelete - 1]);
    } else if (indexToDelete === 0 && tokens && tokens.length && indexToDelete !== tokens.length - 1) {
      this.setActiveToken(tokens[indexToDelete]);
    } else if (indexToDelete === 0 && indexToDelete === tokens.length - 1) {
      this.handleInputFocus();
    }
    this.value = [...this.tokenisedValues];
    const deletedToken = this.typeAheadOptions.filter(item => {
      if (item.label.toLowerCase() === tokenLabel.toLowerCase()) {
        return item;
      }
    });
    if (!this.tokenizedTypeAheadOptions.some(item => item.label === deletedToken[0]?.label)) {
      this.tokenizedTypeAheadOptions.push(...deletedToken);
      this.visibleTokenizedTypeAheadOptions();
    }
    this.handleTextFieldChange({ event, context: this, element: this.elHost, value: this.value });
    if (this.variation === TOKENISED) {
      let deletedTokenObj;
      this.tokenizedTypeAheadOptions.some(item => {
        if (item.label === deletedToken[0]?.label) {
          deletedTokenObj = item;
        }
      });
      this.bricksTextFieldTokenRemove.emit({ event, context: this, element: this.elHost, value: tokenLabel, meta: deletedTokenObj });
    }
  };

  /**
   * Handle clearing of all icons when all are selected
   * @returns
   */
  private handleClearAllTokens = () => {
    this.tokenisedValues = [...[]];
    this.value = [...this.tokenisedValues];
    this.allTokensSelected = false;
    this.handleInputFocus();
    this.handleTextFieldChange({ event: null, context: this, element: this.elHost, value: this.value });
    return;
  };

  /**
   * Set the input on focus if base is clicked
   */
  private handleBaseClick = () => {
    if (this.variation === TOKENISED) {
      this.setFocus();
    }
  };

  /**
   * Shift the focus to the input as soon as the menu closes
   */
  private handleMenuClose = () => {
    this.handleInputFocus();
    this.open = false;
  };

  /**
   * Render the search icon in case of search field
   * @returns Search Icon node
   */
  private renderSearchIcon = (): VNode => {
    const searchIconSrc = 'magnifying-glass';
    return (
      <div part="search-icon" class="text-field-search-icon">
        <bricks-icon exportparts="base: text-field-search-icon" src={searchIconSrc}></bricks-icon>
      </div>
    );
  };

  private renderPrefixIconSlot = (): VNode => {
    if (this.hasPrefixIconSlot) {
      return (
        <div part="prefix-icon" class="text-field-prefix-icon">
          <slot name="prefix-icon"></slot>
        </div>
      );
    }
  };

  private accessoryButton = (event): void => {
    if (this.disableFocusForAccessoryIcon) return;
    if (this.showClearButton && this.value && !this.accessoryIcon) {
      this.handleClearIconClick(event);
    } else if (this.variation === SECURE && this.showPasswordRevealIcon && this.value && !this.accessoryIcon) {
      this.handleEyeIconClick();
    } else {
      this.bricksTextFieldAccessoryIconClick.emit({ event, element: this.elHost, context: this, value: this.value as string });
    }
  };

  private accessoryKeyDown = (event): void => {
    if (this.disableFocusForAccessoryIcon) return;
    if (event.code === 'Enter' || event.code === 'Space') {
      if (this.showClearButton && this.value && !this.accessoryIcon) {
        this.handleClearIconKeyboardClick(event);
      } else if (this.variation === SECURE && this.showPasswordRevealIcon && this.value && !this.accessoryIcon) {
        this.handleEyeIconKeyboardClick(event);
      } else {
        this.bricksTextFieldAccessoryIconClick.emit({ event, element: this.elHost, context: this, value: this.value as string });
      }
      event.preventDefault();
    }
  };

  /**
   * Emits bricksTextFieldAddNewOptionClick event when add new option is click
   */
  private handleAddNewOptionClick = (event: MouseEvent | KeyboardEvent) => {
    this.handleFocusout();
    this.bricksTextFieldAddNewOptionClick.emit({ event, element: this.elHost, context: this, value: this.value as string });
  };

  /**
   * Render clear icon in case show clear icon is true
   * @returns CLear Icon node
   */
  private renderClearIcon = (): VNode => {
    const clearIconSrc = 'multiply-fill';
    return <bricks-icon slot="icon" exportparts="base: text-field-reset-button" src={clearIconSrc}></bricks-icon>;
  };

  /**
   * Render eye/eye-slash icon in case showPasswordRevealIcon is true & variation of text field is SECURE & text field has some value
   * @returns show Password Reveal Icon node
   */
  private renderEyeIcon = (): VNode => {
    const clearIconSrc = 'eyeFill';
    return <bricks-icon exportparts="base: text-field-eye-icon" src={clearIconSrc}></bricks-icon>;
  };

  /**
   * Render accessory icon like calendar
   * @returns Accessory Icon node
   */
  private renderAccessoryIcon = (): VNode => {
    const accessoryIconSrc = this.accessoryIcon;
    return <bricks-icon part="text-field-icon" exportparts="base: text-field-accessory-icon" src={accessoryIconSrc}></bricks-icon>;
  };

  /**
   * Method to handle click on clear all icon to clear the text field
   */
  private handleClearIconClick = (event: MouseEvent | KeyboardEvent) => {
    if (this.disabled || this.readonly) {
      return;
    }
    this.elTextField?.focus();
    this.value = '';
    this.elInput.value = '';
    if (this.variation === TYPE_AHEAD && this.elTypeaheadInput) {
      this.elTypeaheadInput.value = '';
    }
    this.bricksTextFieldClearIconClick.emit({ event, element: this.elHost, context: this, value: this.value as string });

    this.handleTextFieldChange({ event: null, context: this, element: this.elHost, value: this.value });
    event.preventDefault();
  };

  /**
   * Method to handle keyborad click on clear icon to clear the text field
   */
  private handleClearIconKeyboardClick = event => {
    if (event.code === 'Enter' || event.code === 'Space') {
      this.handleClearIconClick(event);
    }
  };

  /**
   * Method to handle click on Eye icon to show/hide password of the secured text field
   */
  private handleEyeIconClick = () => {
    if (this.disabled || this.readonly) {
      return;
    }
    const bricksIcon = this.elBase.getElementsByTagName('bricks-icon')[0].src === 'eyeFill';
    this.elInput.type = bricksIcon ? 'text' : 'password';
    this.accessoryAccessibleTitle = bricksIcon ? 'Hide Password' : 'Show Password';
    this.elBase.getElementsByTagName('bricks-icon')[0].src = bricksIcon ? 'eyeSlashFill' : 'eyeFill';
  };

  /**
   * Handles keyboard click on the eye icon to show/hide password for the secured text field
   */
  private handleEyeIconKeyboardClick = event => {
    if ((event.code === 'Enter' || event.code === 'Space') && !this.isMultiLine) {
      this.handleEyeIconClick();
    }
  };

  /**
   * Slot for custom HTML to allow for more flexibility in rendering custom content
   * @param param0
   * @param children
   * @returns slot
   */
  private MenuItemContent = ({ slot }: { slot: string }, children) => {
    if (!slot) return <Fragment>{children}</Fragment>;
    return <slot name={slot}>{children}</slot>;
  };

  /**
   * Render the typeahead options as per visibile options
   * @returns Array of menuitem nodes
   */
  private renderTypeAheadOptions = (): VNode[] => {
    const { MenuItemContent } = this;
    return this.visibleOptions?.map((option: ITextField.TypeAheadOption) => {
      return (
        <bricks-menu-item exportparts="base: text-field-menu-item" value={option.value} isMultiLine={this.isMultiLine} disabled={option.disabled}>
          <MenuItemContent slot={option.slot}>
            {option.label}
            {option.subtitle && (
              <span part="subtitle" class="subtitle">
                {option.subtitle}
              </span>
            )}
            {option.prefixIcon && this.renderPrefixSuffixIcon(option.prefixIcon, 'prefix', option.iconsType)}
            {(option.suffixIcon || option.suffixText) && this.renderSuffix(option.suffixIcon, option.suffixText, option.iconsType)}
          </MenuItemContent>
        </bricks-menu-item>
      );
    });
  };

  /**
   * Renders suffix icon or text based on condition
   * @param suffixIcon
   * @param suffixText
   * @param iconsType
   * @returns HTMLBricksIconElement | HTMLDivElement
   */
  private renderSuffix = (suffixIcon: string, suffixText: string, iconsType: string): VNode => {
    if ((suffixIcon && suffixText) || suffixIcon) {
      return this.renderPrefixSuffixIcon(suffixIcon, 'suffix', iconsType);
    } else if (suffixText) {
      return this.renderSuffixText(suffixText);
    } else {
      return;
    }
  };

  /**
   * Rendering prefix or sufix icon, custom inline svg, avatar or initials based on icons type
   * @param icon
   * @param position
   * @param option
   * @returns HTMLBricksIconElement | HTMLBricksImgElement | HTMLBricksAvatarElement
   */
  private renderPrefixSuffixIcon = (icon: string, position: string, iconsType: string): VNode => {
    switch (iconsType) {
      case 'custom-inline-svg': {
        return <bricks-icon part={position} exportparts="base: text-field-prefix-suffix-custom-inline-svg" slot={position} size="large" svgData={icon}></bricks-icon>;
      }
      case 'avatar-initials': {
        return <bricks-avatar aria-hidden="true" part={position} exportparts="base: text-field-prefix-suffix-avatar" slot={position} initials={icon} size="small"></bricks-avatar>;
      }
      case 'avatar-icon': {
        return <bricks-avatar aria-hidden="true" part={position} exportparts="base: text-field-prefix-suffix-avatar" slot={position} avatar={icon} size="small"></bricks-avatar>;
      }
      case 'standard' || !iconsType: {
        if (icon.includes('.svg')) {
          return <bricks-icon part={position} exportparts="base: text-field-prefix-suffix-icon" slot={position} size="large" src={icon}></bricks-icon>;
        } else {
          return <bricks-img part={position} exportparts="base: text-field-prefix-suffix-image" slot={position} class={{ [`${position}-image`]: true }} src={icon}></bricks-img>;
        }
      }
    }
  };

  /**
   * Rendering sufix text
   * @param text
   * @returns HTMLDivElement
   */
  private renderSuffixText = (text: string): VNode => {
    return (
      <div aria-hidden={this.disabled ? 'false' : 'true'} part="suffix" exportparts="base: text-field-suffix-text" slot="suffix" class="suffix-text">
        {text}
      </div>
    );
  };

  /**
   * Render single validation states info of text field
   * @returns Node containing state message and icon
   */
  private renderSingleValidationInfo = (): VNode => {
    if (!this.fieldValidationState) return;
    const isInternalValidation = this.internalFieldValidationState.status === 'invalid';
    const isSingleFieldValidation = this.isSingleFieldValidation(this.fieldValidationState);
    if (this.hasFocus && !isSingleFieldValidation) return;
    if (isSingleFieldValidation || this.showInternalValidationsInMultiDimensionalTooltip || isInternalValidation) {
      const { status, message, showIcon } = isInternalValidation ? { ...this.internalFieldValidationState } : { ...(this.fieldValidationState as ITextField.ValidationState) };
      return <FormValidation status={status} showIcon={showIcon} message={message}></FormValidation>;
    }
  };

  /**
   * Render multi validation states info of text field
   * @returns Node containing state message and icon
   */
  private renderMultiValidationInfo = () => {
    if (!this.fieldValidationState) return;
    const fieldValidationState = this.fieldValidationState as ITextField.MultiValidationState;
    if (this.hasFocus && !this.isSingleFieldValidation(this.fieldValidationState)) return;
    if (this.internalFieldValidationState.status !== 'invalid') {
      const validationState = fieldValidationState?.validations?.some(v => v.state === 'invalid');
      if (validationState) {
        return <FormValidation status="invalid" showIcon={true} message={this.fieldValidationState.message}></FormValidation>;
      }
    }
  };

  /**
   * Render list of validation state info
   * @param validationState
   * @returns Node containing the list and the title
   */
  private renderValidationList = validationState => {
    return (
      <div class="validation-list">
        {validationState?.map(validation => {
          return (
            <div class={{ 'validation-tooltip--message': true, [`state--${validation.state}`]: true }}>
              <bricks-icon exportparts="text-field-validation-state-icon" src={validationIcon[validation.state]}></bricks-icon>
              <p>{validation.message}</p>
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Render multi dimentional validation details inside the tooltip
   * @returns Node containing the list and the title
   */
  private renderMultiDimensionalTooltip = (): VNode => {
    if (!this.fieldValidationState) return;
    return (
      <div class="validation-wrapper">
        <p class="validation-title">{(this.fieldValidationState as ITextField.MultiValidationState).title}</p>
        {this.renderValidationList(this.internalValidationStateArray)}
        {this.renderValidationList((this.fieldValidationState as ITextField.MultiValidationState).validations)}
      </div>
    );
  };

  /**
   * Resets the token style back to normal state
   * @param eventType string - 'drop' | 'dragEnd'
   */
  private resetTokenStyle = (eventType: string) => {
    [...this.elTokensWrapper.querySelectorAll('span')].forEach(item => {
      if (eventType === 'drop' || eventType === 'dragEnd') {
        item.querySelector('bricks-token').setBlur();
        item.style.opacity = '1';
      }
      item.classList?.remove('token-hover');
      item.classList?.remove('last-token');
    });
  };

  /**
   * Handle drag start event
   * @param event any
   */
  private dragStart = event => {
    this.dragSourceToken = event.currentTarget;
    this.dragSourceToken.style.opacity = '0.4';
    event.dataTransfer.effectAllowed = 'move';
  };

  /**
   * Handle drag over event
   * Source token and target token has the same position doesn't get any drop position
   * Target token position(token left + (token width / 2)) is less than mouse cursor position(clientX) then drop position is before the token
   * Target token position(token left + (token width / 2)) is greater than mouse cursor position(clientX) then drop position is after the token
   * Target token position(token left + (token width / 2)) is greater than mouse cursor position(clientX) and target token is after last token then drop position is after the token
   * @param event DragEvent
   */
  private dragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const sourceTokenIndex = Number(this.dragSourceToken.getAttribute('data-val'));
    const targetTokenIndex = Number((event.currentTarget as Element).getAttribute('data-val'));
    const targetStartPosition = Math.round((event.currentTarget as Element).getBoundingClientRect().left);
    const targetwidth = (event.currentTarget as HTMLElement).offsetWidth;
    const tempTokenisedValues = [...this.tokenisedValues];
    const lastElemenet = targetTokenIndex === tempTokenisedValues.length - 1;
    const targetPosition = targetStartPosition + Math.round(targetwidth / 2);
    const tokensList = this.elTokensWrapper.querySelectorAll('span');
    this.resetTokenStyle('dragOver');
    if (
      sourceTokenIndex === targetTokenIndex ||
      (sourceTokenIndex === targetTokenIndex + 1 && targetPosition < event.clientX) ||
      (sourceTokenIndex + 1 === targetTokenIndex && targetPosition > event.clientX)
    ) {
      this.targetIndex = sourceTokenIndex;
      (event.currentTarget as Element).classList.remove('token-hover');
    } else if (targetPosition > event.clientX) {
      sourceTokenIndex < targetTokenIndex ? (this.targetIndex = targetTokenIndex - 1) : (this.targetIndex = targetTokenIndex);
      tokensList[targetTokenIndex]?.classList.add('token-hover');
    } else if (targetPosition < event.clientX && !lastElemenet) {
      sourceTokenIndex < targetTokenIndex ? (this.targetIndex = targetTokenIndex) : (this.targetIndex = targetTokenIndex - 1);
      tokensList[targetTokenIndex + 1]?.classList.add('token-hover');
    } else if (targetPosition < event.clientX && lastElemenet) {
      this.targetIndex = targetTokenIndex;
      tokensList[targetTokenIndex]?.classList.add('token-hover');
      tokensList[targetTokenIndex]?.classList.add('last-token');
    }
  };

  /**
   * Handle dragleave event
   * @param event DragEvent
   */
  private dragLeave(event: DragEvent) {
    (event.currentTarget as Element).classList.remove('token-hover');
  }

  /**
   * Handle drop event
   * @param event DragEvent
   */
  private drop = event => {
    this.resetTokenStyle('drop');
    if (this.dragSourceToken != event.currentTarget) {
      const targetLabel = this.dragSourceToken.querySelector('bricks-token').tokenLabel;
      const tempTokens = [...this.tokenisedValues];
      const labelIndex = Number(this.dragSourceToken.getAttribute('data-val'));
      tempTokens.splice(labelIndex, 1);
      tempTokens.splice(this.targetIndex, 0, targetLabel);
      this.isTokensUpdated = JSON.stringify(tempTokens) !== JSON.stringify(this.tokenisedValues);
      this.tokenisedValues = [...tempTokens];
      event.currentTarget.classList.remove('token-hover');
    }
  };

  /**
   * Handle dragend event
   */
  private dragEnd = () => {
    this.resetTokenStyle('dragEnd');
    if (this.isTokensUpdated) {
      this.handleTextFieldChange({ event: null, context: this, element: this.elHost, value: [...this.tokenisedValues] });
    }
    this.isTokensUpdated = false;
  };

  /**
   * Render tokens from tokenisedValues Array
   * @returns HTMLBricksTokenElement[]
   */
  private renderTokens = (): VNode[] => {
    return this.tokenisedValues?.map((value, index) => {
      const requiredOption = this.typeAheadOptions.find(option => option.label === value);
      const customTokenPart = `base: text-field-token-${requiredOption?.tokenPart}, content:${requiredOption?.tokenPart}, remove-icon: text-field-remove-icon-${requiredOption?.tokenPart}, removable-icon: remove-icon-${requiredOption?.tokenPart}`;
      return (
        <span
          data-val={index}
          draggable={this.enableDraggableTokens}
          class="draggable"
          onDragStart={event => this.dragStart(event)}
          onDragOver={event => this.dragOver(event)}
          onDragLeave={event => this.dragLeave(event)}
          onDrop={event => this.drop(event)}
          onDragEnd={() => this.dragEnd()}
        >
          <bricks-token
            exportparts={requiredOption?.tokenPart ? customTokenPart : 'base: text-field-token'}
            removable={this.showCloseIconForTokens}
            tabIndex={-1}
            disabled={this.disabled}
            tokenLabel={value}
            onBricksTokenRemove={event => this.handleRemoveToken(event, value)}
          ></bricks-token>
        </span>
      );
    });
  };

  /**
   * Update the character limit while onchange of input on every 1sec
   */
  private updateLiveRegionForHintText() {
    let myTimeout = null;
    let characterLimit;
    clearTimeout(myTimeout);
    myTimeout = setTimeout(() => {
      if (this.maxLength >= this.value.length) {
        characterLimit = `${this.helperTextTitle}: ${(this.maxLength - this.value.length).toString()}`;
      } else {
        characterLimit = `${this.helperTextExceededTitle}: ${Math.abs(this.maxLength - this.value.length).toString()}`;
      }
      if (this.elHelperText) {
        this.elHelperText.textContent = characterLimit;
      }
    }, 1000);
  }

  /**
   * Returns the validation class substring based on internal and external validation
   * @returns string
   */
  private getValidationClass = (): string => {
    if (this.internalFieldValidationState.status === 'valid' && this.isSingleFieldValidation(this.fieldValidationState) && this.fieldValidationState?.status === 'valid') {
      return 'valid';
    }
    if (this.internalFieldValidationState.status === 'invalid') {
      return this.internalFieldValidationState.status;
    } else if (this.isSingleFieldValidation(this.fieldValidationState)) {
      return this.fieldValidationState?.status;
    } else {
      const validationState = this.fieldValidationState?.validations.some(v => v.state === 'invalid');
      return validationState ? 'invalid' : 'valid';
    }
  };

  /**
   * Sets up the element's `tag` to an TextArea (`textarea`), if `isMultiLine` is true.
   * Also, it sets up the corresponding attributes, based on the tag type.
   */
  private useInputTagType = () => {
    const TagType = this.isMultiLine ? 'textarea' : 'input';
    const isSecureField = this.variation === SECURE;
    const isSearchField = this.variation === SEARCH;
    let attrs;

    if (TagType === 'input') {
      attrs = { type: isSecureField ? 'password' : isSearchField ? 'search' : 'text', ref: el => (this.elInput = el) };
    }

    if (TagType === 'textarea') {
      attrs = {
        rows: this.rows,
        cols: this.cols,
        ref: el => (this.elTextArea = el)
      };
    }

    return [TagType, attrs];
  };

  /**
   * Get aria-invalid status depending on various conditions
   * @returns boolean
   */
  private getInValidStatus = (): boolean => {
    if (!this.fieldValidationState) return;
    if (this.isSingleFieldValidation(this.fieldValidationState)) {
      return this.fieldValidationState.status === INVALID || this.internalFieldValidationState.status === INVALID;
    } else {
      const validationState = this.fieldValidationState.validations.some(v => v.state === 'invalid');
      return validationState;
    }
  };

  /**
   * Calculate width of text based on font size and weight
   * 24 is addition of left and right padding of input element.
   * @param text
   * @returns textWidth
   */
  calculateTextWidth(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const computedElem = window.getComputedStyle(this.elInput);
    ctx.font = computedElem.fontSize + ' ' + computedElem.fontFamily;
    return ctx.measureText(text).width + 24;
  }

  /**
   * Handle focus out event on add label icon container
   */
  private handleFocusout = () => {
    this.hasFocus = false;
  };

  /**
   * Handle focus in event on add label icon container
   */
  private handleFocusin = () => {
    this.hasFocus = true;
  };

  render() {
    const isTypeAheadField = this.variation === TYPE_AHEAD;
    const isSearchField = this.variation === SEARCH;
    const isSecureField = this.variation === SECURE;
    const isInvalid = this.getInValidStatus() ? this.getInValidStatus().toString() : null;
    const isStandardField = this.variation === STANDARD;
    const isTokenised = this.variation === TOKENISED;
    const title = isTypeAheadField || isSearchField || isStandardField ? this.value : '';
    const doesFieldSupportPatternValidation = isSearchField || isStandardField || isSecureField; // Only search, standard and secure fields support pattern validation
    const doesFieldSupportMinMaxLengthValidation = isSearchField || isStandardField || isSecureField; // Only search, standard and secure fields support min-length validation
    const [TagType, attrs] = this.useInputTagType();

    const showDropdown = isTypeAheadField || isTokenised;

    const { autocomplete, spellcheck, autocorrect, autocapitalize } = this.browserInputProperties;
    const { inheritedAttributes } = this;

    const isTypeahead = (this.variation === TYPE_AHEAD && !this.isChildOfSelector) || (this.isChildOfSelector && this.typeaheadValue !== '' && !this.readonly);

    const tagTypeElement = (
      <TagType
        {...attrs}
        {...this.inheritedDataAttributes}
        part="input"
        class={{
          [`text-field-variation--${this.variation}`]: Boolean(this.variation),
          [`text-field-has-accessory-icon`]: Boolean(this.showClearButton || this.showPasswordRevealIcon || this.accessoryIcon.length || Boolean(this.hasAccessoryIconSlot)),
          [`text-field-visual-style--${this.visualStyle}`]: Boolean(this.visualStyle),
          [`text-field-state--${this.getValidationClass()}`]: true,
          'text-field-has-value': Boolean(this.value?.length),
          'text-field-has-search-icon': Boolean(this.showSearchIcon),
          'text-field-has-prefix-icon': Boolean(this.hasPrefixIconSlot),
          'text-field-has-placeholder': Boolean(this.placeHolderText.length),
          'text-field-disabled': Boolean(this.disabled),
          'text-field-read-only': Boolean(this.readonly),
          'text-field-has-tokens': Boolean(isTokenised && this.tokenisedValues.length),
          'no-border': Boolean(isTokenised)
        }}
        tabIndex={this.disabled ? '-1' : this.tabIndexValue}
        readonly={this.readonly}
        id={this.componentId}
        title={title as string}
        {...(!this.tokenisedValues.length ? { placeholder: this.placeHolderText } : '')}
        value={isTokenised ? '' : this.value}
        disabled={this.disabled}
        required={this.required}
        aria-autocomplete={showDropdown ? 'list' : null}
        autocapitalize={autocapitalize}
        autocomplete={autocomplete}
        autocorrect={autocorrect}
        spellcheck={spellcheck}
        aria-hidden={this.isHidden.toString()}
        {...(this.disabled ? { 'aria-disabled': 'true' } : '')}
        aria-readOnly={this.readonly.toString()}
        aria-required={this.required.toString()}
        aria-invalid={isInvalid}
        {...(this.pattern && doesFieldSupportPatternValidation ? { pattern: `${this.pattern}` } : '')}
        {...(this.minLength && doesFieldSupportMinMaxLengthValidation ? { minlength: `${this.minLength}` } : '')}
        {...(this.maxLength && this.enforceMaxLength && doesFieldSupportMinMaxLengthValidation ? { maxlength: `${this.maxLength}` } : '')}
        aria-describedby={
          this.hasFocus && ((this.fieldValidationState as ITextField.MultiValidationState)?.validations?.length || this.showInternalValidationsInMultiDimensionalTooltip)
            ? `multi-dimensional-tooltip--${this.componentId} helper-info-section`
            : `text-field-description--${this.componentId} text-field-helper--${this.componentId} helper-info-section`
        }
        aria-labelledby={`text-field-labelledby--${this.componentId}`}
        onInput={this.handleOnInputChange}
        onFocus={this.handleInputFocus}
        onBlur={this.handleInputBlur}
        onKeyDown={this.handleInputKeyDown}
        onKeyUp={this.handleInputKeyUp}
        onkeyPress={this.handleInputKeyPress}
        onPaste={this.variation === 'tokenised' && this.handlePaste}
      ></TagType>
    );

return (
  <Host class={{ disabled: this.disabled }}>
    <div
      class={{
        'text-field-wrapper': true,
        [`wrapper-state--${this.getValidationClass()}`]: true,
        ['wrapper-state-validation-icon']: Boolean((this.fieldValidationState as ITextField.ValidationState)?.showIcon || this.internalFieldValidationState?.showIcon),
        'is-multi-line-typeahead': this.isMultiLine
      }}
      role="group"
      aria-labelledby={`text-field-label-${this.componentId}`}
      aria-describedby={`text-field-helper-${this.componentId} text-field-description-${this.componentId}`}
    >
      <span
        part="base"
        class={{
          [`variation--${this.variation}`]: Boolean(this.variation),
          [`visual-style--${this.visualStyle}`]: Boolean(this.visualStyle),
          'has-search-icon': Boolean(this.showSearchIcon),
          'has-prefix-icon': Boolean(this.hasPrefixIconSlot),
          'has-accessory-icon': Boolean(this.showClearButton || this.showPasswordRevealIcon || this.accessoryIcon.length || Boolean(this.hasAccessoryIconSlot)),
          'has-focus-with-tokens': (Boolean(this.hasFocus) || Boolean(this.value?.length) || Boolean(this.tokenisedValues.length)) && Boolean(isTokenised)
        }}
        ref={el => (this.elBase = el)}
        onKeyDown={!this.readonly && this.handleBaseKeyDown}
        onClick={!this.readonly && this.handleBaseClick}
        role="textbox"
        aria-required={this.required.toString()}
        aria-invalid={this.invalid.toString()}
      >
        {/* Typeahead Support */}
        {isTypeahead && !this.disableTypeaheadText && !this.isMultiLine && (
          <input
            part="typeahead-input"
            type="text"
            tabindex="-1"
            aria-hidden="true"
            readonly
            value={this.typeaheadValue}
            ref={el => (this.elTypeaheadInput = el)}
            class={{
              [`text-field-variation--${this.variation}`]: Boolean(this.variation),
              [`text-field-visual-style--${this.visualStyle}`]: Boolean(this.visualStyle),
              'text-field-read-only': Boolean(this.readonly),
              'text-field-has-search-icon': Boolean(this.showSearchIcon),
              typeahead: true
            }}
          />
        )}

        {/* Tokenized Field Support */}
        {isTokenised ? (
          <span class="text-field-tokenised-wrapper">
            <span class="text-field__tokens">
              <span part="tokens" ref={el => (this.elTokensWrapper = el)}>
                {this.renderTokens()}
              </span>
            </span>
            {tagTypeElement}
          </span>
        ) : (
          tagTypeElement
        )}

        {/* Label */}
        <label
          part="label"
          ref={el => (this.elLabel = el)}
          id={`text-field-label-${this.componentId}`}
          class={{
            'text-field-label-helpertext': Boolean(this.showHelperText),
            [`text-field-has-accessory-icon`]: Boolean(this.showClearButton || this.showPasswordRevealIcon || this.accessoryIcon.length || Boolean(this.hasAccessoryIconSlot)),
            'is-multi-line': this.isMultiLine
          }}
        >
          {this.label}
        </label>

        {/* Dropdown */}
        {showDropdown && (
          <bricks-menu-button exportparts="base: text-field-menu-button" ref={el => (this.elTypeAheadMenuButton = el)} onBricksMenuClosed={this.handleMenuClose} hoist={this.hoist}>
            <bricks-menu
              class={{ 'is-multi-line': this.isMultiLine }}
              exportparts="base: text-field-menu"
              ref={el => (this.elMenu = el)}
              onBricksMenuSelect={this.handleMenuSelection}
              onBricksMenuScroll={this.handleMenuScroll}
              isMultiLine={this.isMultiLine}
              aria-labelledby={`text-field-label-${this.componentId}`}
            >
              {this.renderTypeAheadOptions()}
            </bricks-menu>
          </bricks-menu-button>
        )}

        {/* No Match Found */}
        {!!this.typeAheadOptions.length &&
          (this.variation === TYPE_AHEAD || (this.variation === TOKENISED && !!this.tokenizedTypeAheadOptions.length)) &&
          !this.visibleOptions.length &&
          this.hasFocus && (
            <div class="no-match-found" style={{ width: this.elMenu.style.width }} role="alert" aria-live="polite">
              <bricks-label exportparts="base: no-match-found" class={{ 'no-match-label': this.enableAddNewOption }}>
                {this.noMatchFoundMessage}
              </bricks-label>
            </div>
          )}

        {/* Helper Text */}
        {this.showHelperText && this.maxLength && (
          <div part="helper-text" class="text-field__helper-text" id={`text-field-helper-${this.componentId}`}>
            <span aria-hidden="true">{(this.maxLength - this.value.length).toString()}</span>
            <span class="visible-to-screen-readers-only" ref={el => (this.elHelperText = el)}></span>
          </div>
        )}

        {/* Search Icon */}
        {this.showSearchIcon ? this.renderSearchIcon() : this.renderPrefixIconSlot()}

        {/* Accessory Icon */}
        {(this.showClearButton || this.showPasswordRevealIcon || this.accessoryIcon || this.hasAccessoryIconslot) && (
          <div
            part="accessory-icon"
            class={{
              'text-field-accessory-icon': true,
              [`text-field-calendar-icon`]: this.accessoryIcon === 'calendar',
              ['text-field-accessory-clear-password-icon']: Boolean(this.showClearButton || this.showPasswordRevealIcon),
              ['active']: Boolean(this.value),
              disabled: Boolean(this.disableFocusForAccessoryIcon) || Boolean(this.disabled)
            }}
            tabindex={this.disabled || this.disableFocusForAccessoryIcon ? null : 0}
            role={this.disabled || this.disableFocusForAccessoryIcon ? null : 'button'}
            onClick={this.accessoryButton}
            onKeyDown={this.accessoryKeyDown}
            aria-label={this.accessoryAccessibleTitle.length > 0 ? this.accessoryAccessibleTitle : null}
            aria-hidden={this.disabled || this.disableFocusForAccessoryIcon ? 'true' : null}
          >
            <slot name="accessory-icon">
              {this.showClearButton && this.value && !this.accessoryIcon
                ? this.renderClearIcon()
                : isSecureField && this.showPasswordRevealIcon && this.value && !this.accessoryIcon
                  ? this.renderEyeIcon()
                  : this.accessoryIcon.length
                    ? this.renderAccessoryIcon()
                    : null}
            </slot>
          </div>
        )}

        {/* Validation Icon */}
        <span class="text-field-validation-icon" id={`text-field-description-${this.componentId}`} role="status" aria-live="polite">
          {this.renderSingleValidationInfo()}
          {this.renderMultiValidationInfo()}
        </span>
      </span>
    </div>
  </Host>
);

  }

  /**
   * Check if the fieldvalidation prop is ITextField.ValidationState type of IMultITextField.ValidationState type
   * @param fieldValidation
   * @returns
   */
  private isSingleFieldValidation = (fieldValidation: ITextField.ValidationState | ITextField.MultiValidationState): fieldValidation is ITextField.ValidationState => {
    return (fieldValidation as ITextField.ValidationState)?.status !== undefined;
  };
}