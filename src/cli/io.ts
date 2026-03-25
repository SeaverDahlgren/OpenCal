import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export class ConsoleIO {
  private readonly rl = readline.createInterface({ input, output });

  print(message: string) {
    output.write(`${message}\n`);
  }

  async ask(prompt: string): Promise<string> {
    const answer = await this.rl.question(`${prompt}\n> `);
    return answer.trim();
  }

  async confirm(prompt: string, defaultYes = true): Promise<boolean> {
    const suffix = defaultYes ? "[Y/n]" : "[y/N]";
    const answer = (await this.rl.question(`${prompt} ${suffix}\n> `)).trim().toLowerCase();
    if (!answer) {
      return defaultYes;
    }
    return answer === "y" || answer === "yes";
  }

  async choose<T extends { label: string; value: string }>(
    prompt: string,
    options: T[],
  ): Promise<T | undefined> {
    this.print(prompt);
    options.forEach((option, index) => {
      this.print(`${index + 1}. ${option.label}`);
    });

    const answer = await this.ask("Select a number or press Enter to cancel");
    if (!answer) {
      return undefined;
    }

    const index = Number(answer);
    if (!Number.isInteger(index) || index < 1 || index > options.length) {
      this.print("Invalid selection.");
      return undefined;
    }

    return options[index - 1];
  }

  close() {
    this.rl.close();
  }
}
