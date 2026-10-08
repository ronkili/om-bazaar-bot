require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const config = require("./config");

const commands = [
  new SlashCommandBuilder()
    .setName(
      "casino"
    )
    .setDescription(
      "מציג את כל פקודות הקזינו"
    ),

  new SlashCommandBuilder()
    .setName(
      "xp"
    )
    .setDescription(
      "מציג את יתרת ה־XP שלך"
    ),

  new SlashCommandBuilder()
    .setName(
      "leaderboard"
    )
    .setDescription(
      "מציג את Top 10 של ה־XP"
    ),

  new SlashCommandBuilder()
    .setName(
      "coinflip"
    )
    .setDescription(
      "Coinflip עם XP"
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription("כמות XP להימור")
          .setRequired(true)
          .setMinValue(1)
    )
    .addStringOption(
      option =>
        option
          .setName("side")
          .setDescription("Heads או Tails")
          .setRequired(true)
          .addChoices(
            { name: "Heads", value: "heads" },
            { name: "Tails", value: "tails" }
          )
    ),

  new SlashCommandBuilder()
    .setName(
      "dice"
    )
    .setDescription(
      "נחש מספר בקובייה"
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription("כמות XP להימור")
          .setRequired(true)
          .setMinValue(1)
    )
    .addIntegerOption(
      option =>
        option
          .setName("number")
          .setDescription("מספר בין 1 ל־6")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(6)
    ),

  new SlashCommandBuilder()
    .setName(
      "slots"
    )
    .setDescription(
      "מכונת Slots עם XP"
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription("כמות XP להימור")
          .setRequired(true)
          .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName(
      "roulette"
    )
    .setDescription(
      "Roulette — Red / Black / Green"
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription("כמות XP להימור")
          .setRequired(true)
          .setMinValue(1)
    )
    .addStringOption(
      option =>
        option
          .setName("color")
          .setDescription("בחר צבע")
          .setRequired(true)
          .addChoices(
            { name: "🔴 Red", value: "red" },
            { name: "⚫ Black", value: "black" },
            { name: "🟢 Green", value: "green" }
          )
    ),

  new SlashCommandBuilder()
    .setName(
      "highlow"
    )
    .setDescription(
      "נחש אם הקלף הבא גבוה או נמוך"
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription("כמות XP להימור")
          .setRequired(true)
          .setMinValue(1)
    )
    .addStringOption(
      option =>
        option
          .setName("guess")
          .setDescription("Higher או Lower")
          .setRequired(true)
          .addChoices(
            { name: "⬆️ Higher", value: "higher" },
            { name: "⬇️ Lower", value: "lower" }
          )
    ),

  new SlashCommandBuilder()
    .setName(
      "rps"
    )
    .setDescription(
      "Rock Paper Scissors מול הבוט"
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription("כמות XP להימור")
          .setRequired(true)
          .setMinValue(1)
    )
    .addStringOption(
      option =>
        option
          .setName("choice")
          .setDescription("בחר מהלך")
          .setRequired(true)
          .addChoices(
            { name: "✊ Rock", value: "rock" },
            { name: "✋ Paper", value: "paper" },
            { name: "✌️ Scissors", value: "scissors" }
          )
    ),

  new SlashCommandBuilder()
    .setName(
      "number"
    )
    .setDescription(
      "Lucky Number — נחש מספר 1 עד 10"
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription("כמות XP להימור")
          .setRequired(true)
          .setMinValue(1)
    )
    .addIntegerOption(
      option =>
        option
          .setName("number")
          .setDescription("מספר בין 1 ל־10")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10)
    ),

  new SlashCommandBuilder()
    .setName(
      "wheel"
    )
    .setDescription(
      "גלגל מכפילי XP"
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription("כמות XP להימור")
          .setRequired(true)
          .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName(
      "jackpot"
    )
    .setDescription(
      "Mega Jackpot — Lucky Roll"
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription("כמות XP להימור")
          .setRequired(true)
          .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName(
      "challenge"
    )
    .setDescription(
      "מאתגר משתמש להימור 1V1 על XP"
    )
    .addUserOption(
      option =>
        option
          .setName("user")
          .setDescription("את מי לאתגר")
          .setRequired(true)
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription("כמות XP שכל שחקן שם")
          .setRequired(true)
          .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName(
      "setup-xp-shop"
    )
    .setDescription(
      "שולח את פאנל ה־XP Shop"
    ),

  new SlashCommandBuilder()
    .setName(
      "ticket-panel"
    )
    .setDescription(
      "שולח את פאנל הטיקטים"
    ),

  new SlashCommandBuilder()
    .setName(
      "setup-verify"
    )
    .setDescription(
      "מגדיר Verify וחדרי Members אוטומטית"
    ),

  new SlashCommandBuilder()
    .setName(
      "verify-panel"
    )
    .setDescription(
      "שולח את פאנל ה־Verify"
    ),

  new SlashCommandBuilder()
    .setName(
      "timeout"
    )
    .setDescription(
      "Timeout — הנהלה בלבד"
    )
    .addUserOption(
      option =>
        option
          .setName(
            "user"
          )
          .setDescription(
            "המשתמש"
          )
          .setRequired(
            true
          )
    )
    .addStringOption(
      option =>
        option
          .setName(
            "duration"
          )
          .setDescription(
            "משך הזמן"
          )
          .setRequired(
            true
          )
          .addChoices(
            {
              name:
                "10 דקות",
              value: "10m"
            },
            {
              name:
                "30 דקות",
              value: "30m"
            },
            {
              name:
                "שעה",
              value: "1h"
            },
            {
              name:
                "6 שעות",
              value: "6h"
            },
            {
              name:
                "12 שעות",
              value: "12h"
            },
            {
              name:
                "יום",
              value: "1d"
            },
            {
              name:
                "3 ימים",
              value: "3d"
            },
            {
              name:
                "7 ימים",
              value: "7d"
            }
          )
    )
    .addStringOption(
      option =>
        option
          .setName(
            "reason"
          )
          .setDescription(
            "סיבה"
          )
          .setRequired(
            false
          )
    ),

  new SlashCommandBuilder()
    .setName(
      "untimeout"
    )
    .setDescription(
      "מסיר Timeout — הנהלה בלבד"
    )
    .addUserOption(
      option =>
        option
          .setName(
            "user"
          )
          .setDescription(
            "המשתמש"
          )
          .setRequired(
            true
          )
    ),

  new SlashCommandBuilder()
    .setName(
      "clear"
    )
    .setDescription(
      "מוחק הודעות — הנהלה בלבד"
    )
    .addIntegerOption(
      option =>
        option
          .setName(
            "amount"
          )
          .setDescription(
            "כמות הודעות למחיקה"
          )
          .setRequired(
            true
          )
          .setMinValue(
            1
          )
          .setMaxValue(
            100
          )
    )
].map(
  command =>
    command.toJSON()
);

const rest =
  new REST({
    version: "10"
  }).setToken(
    process.env.TOKEN
  );

(async () => {
  try {
    console.log(
      "🔄 Deploying commands..."
    );

    await rest.put(
      Routes.applicationGuildCommands(
        config.clientId,
        config.guildId
      ),
      {
        body:
          commands
      }
    );

    console.log(
      "✅ Commands deployed."
    );
  } catch (error) {
    console.error(
      "❌ Deploy error:",
      error
    );

    process.exitCode = 1;
  }
})();
