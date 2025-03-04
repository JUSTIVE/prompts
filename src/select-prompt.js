// Import Node.js Dependencies
import { EOL } from "node:os";

// Import Third-party Dependencies
import kleur from "kleur";

// Import Internal Dependencies
import { AbstractPrompt } from "./abstract-prompt.js";
import { SYMBOLS } from "./constants.js";

export class SelectPrompt extends AbstractPrompt {
  activeIndex = 0;

  get choices() {
    return this.options.choices;
  }

  constructor(message, options) {
    const {
      stdin = process.stdin,
      stdout = process.stdout,
      choices
    } = options ?? {};

    super(message, stdin, stdout);

    if (!options) {
      this.destroy();
      throw new TypeError("Missing required options");
    }

    this.options = options;

    if (!choices?.length) {
      this.destroy();
      throw new TypeError("Missing required param: choices");
    }

    this.longestChoice = Math.max(...choices.map((choice) => {
      if (typeof choice === "string") {
        return choice.length;
      }

      const kRequiredChoiceProperties = ["label", "value"];

      for (const prop of kRequiredChoiceProperties) {
        if (!choice[prop]) {
          this.destroy();
          throw new TypeError(`Missing ${prop} for choice ${JSON.stringify(choice)}`);
        }
      }

      return choice.label.length;
    }));
  }

  #getFormattedChoice(choiceIndex) {
    const choice = this.choices[choiceIndex];

    if (typeof choice === "string") {
      return { value: choice, label: choice };
    }

    return choice;
  }

  #getVisibleChoices() {
    const maxVisible = this.options.maxVisible || 8;
    let startIndex = Math.min(this.choices.length - maxVisible, this.activeIndex - Math.floor(maxVisible / 2));
    if (startIndex < 0) {
      startIndex = 0;
    }

    const endIndex = Math.min(startIndex + maxVisible, this.choices.length);

    return { startIndex, endIndex };
  }

  #showChoices() {
    const { startIndex, endIndex } = this.#getVisibleChoices();
    this.lastRender = { startIndex, endIndex };

    for (let choiceIndex = startIndex; choiceIndex < endIndex; choiceIndex++) {
      const choice = this.#getFormattedChoice(choiceIndex);
      const isChoiceSelected = choiceIndex === this.activeIndex;
      const showPreviousChoicesArrow = startIndex > 0 && choiceIndex === startIndex;
      const showNextChoicesArrow = endIndex < this.choices.length && choiceIndex === endIndex - 1;

      let prefixArrow = " ";
      if (showPreviousChoicesArrow) {
        prefixArrow = SYMBOLS.Previous;
      }
      else if (showNextChoicesArrow) {
        prefixArrow = SYMBOLS.Next;
      }

      const prefix = `${prefixArrow}${isChoiceSelected ? `${SYMBOLS.Pointer} ` : "  "}`;
      const formattedLabel = choice.label.padEnd(
        this.longestChoice < 10 ? this.longestChoice : 0
      );
      const formattedDescription = choice.description ? ` - ${choice.description}` : "";
      const color = isChoiceSelected ? kleur.white().bold : kleur.gray;
      const str = color(`${prefix}${formattedLabel}${formattedDescription}${EOL}`);

      this.write(str);
    }
  }

  #showAnsweredQuestion(choice) {
    const prefix = `${SYMBOLS.Tick} ${kleur.bold(this.message)} ${SYMBOLS.Pointer}`;
    const formattedChoice = kleur.yellow(choice.label ?? choice);

    this.write(`${prefix} ${formattedChoice}${EOL}`);
  }

  async select() {
    this.write(SYMBOLS.HideCursor);
    this.#showQuestion();

    const render = (options = {}) => {
      const {
        initialRender = false,
        clearRender = false
      } = options;

      if (!initialRender) {
        let linesToClear = this.lastRender.endIndex - this.lastRender.startIndex;
        while (linesToClear > 0) {
          this.clearLastLine();
          linesToClear--;
        }
      }

      if (clearRender) {
        this.stdout.moveCursor(0, -2);
        this.stdout.clearScreenDown();

        return;
      }

      this.#showChoices();
    };

    render({ initialRender: true });

    return new Promise((resolve) => {
      const onKeypress = (value, key) => {
        if (key.name === "up") {
          this.activeIndex = this.activeIndex === 0 ? this.choices.length - 1 : this.activeIndex - 1;
          render();
        }
        else if (key.name === "down") {
          this.activeIndex = this.activeIndex === this.choices.length - 1 ? 0 : this.activeIndex + 1;
          render();
        }
        else if (key.name === "return") {
          this.stdin.off("keypress", onKeypress);

          render({ clearRender: true });

          const currentChoice = this.choices[this.activeIndex];
          const value = currentChoice.value ?? currentChoice;

          if (!this.options.ignoreValues?.includes(value)) {
            this.#showAnsweredQuestion(currentChoice);
          }

          this.write(SYMBOLS.ShowCursor);
          this.destroy();

          resolve(value);
        }
      };

      this.stdin.on("keypress", onKeypress);
    });
  }

  #showQuestion() {
    this.write(`${SYMBOLS.QuestionMark} ${kleur.bold(this.message)}${EOL}`);
  }
}
