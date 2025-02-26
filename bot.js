require("dotenv").config(); // Load environment variables
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
} = require("discord.js");
const fs = require("fs"); // Import the fs module to read files
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Required to read message content
    ],
});

const token = process.env.BOT_TOKEN; // Load token from .env file

// Load questions from questions.json
const questions = JSON.parse(fs.readFileSync("questions.json", "utf-8"));

let currentQuestion = null;
let lastQuestion = null; // Track the last question asked
let quizActive = false; // Control whether the quiz is active
const scores = new Map();
const answeredUsers = new Set(); // Track users who have answered
let countdownInterval = null; // Store the countdown interval

// Allowed role IDs for admin commands
const allowedRoleIds = ["1322237538232172568", "1342591205455954012"]; // Replace with your role IDs

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

function getRandomQuestion() {
    let randomQuestion;
    do {
        // Select a random question
        randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    } while (randomQuestion === lastQuestion); // Ensure it's not the same as the last question

    lastQuestion = randomQuestion; // Update the last question asked
    return randomQuestion;
}
let questionTimeout = null; // Track the setTimeout for the next question

async function postDailyQuestion() {
    if (!quizActive) return; // Do not post questions if the quiz is inactive

    const randomQuestion = getRandomQuestion(); // Get a non-repeating random question
    currentQuestion = randomQuestion;
    answeredUsers.clear(); // Reset answered users for the new question

    // Create an embed with RTL text and image
    const embed = new EmbedBuilder()
        .setTitle("\u200F🎌 سؤال الأنمي اليومي 🎌") // RTL mark + reversed text
        .setDescription("\u200F" + randomQuestion.question) // RTL mark
        .setColor("#FFD700") // Gold color
        .setThumbnail("https://static.wikia.nocookie.net/frieren/images/9/96/Himmel_anime_portrait.png/revision/latest?cb=20231017083515") // Updated image URL
        .setImage(randomQuestion.image) // Add the question image
        .addFields(
            { name: "\u200B", value: "\u200B", inline: false }, // Invisible spacer field
        )
        .addFields(
            {
                name: "\u200Fالوقت المتبقي",
                value: "\u200F⏳ 10 ثواني",
                inline: false,
            }, // RTL mark + reversed text
        )
        .addFields(
            { name: "\u200B", value: "\u200B", inline: false }, // Invisible spacer field
        )
        .setFooter({
            text: "\u200Fأنمي كويز بوت",
        }) // Updated image URL
        .setTimestamp(); // Add a timestamp

    // Send the embed and store the message
    const questionMessage = await client.channels.cache
        .get("1343357167528448081")
        .send({ embeds: [embed] });

    let answerTime = 10;

    // Update the embed every second
    countdownInterval = setInterval(async () => {
        answerTime--;

        // Update the embed with the new time
        const updatedEmbed = new EmbedBuilder()
            .setTitle("\u200F🎌 سؤال الأنمي اليومي 🎌")
            .setDescription("\u200F" + randomQuestion.question)
            .setColor("#FFD700")
            .setThumbnail("https://static.wikia.nocookie.net/frieren/images/9/96/Himmel_anime_portrait.png/revision/latest?cb=20231017083515")
            .setImage(randomQuestion.image)
            .addFields(
                { name: "\u200B", value: "\u200B", inline: false },
            )
            .addFields(
                {
                    name: "\u200Fالوقت المتبقي",
                    value: `\u200F⏳ ${answerTime} ثانية`,
                    inline: false,
                },
            )
            .addFields(
                { name: "\u200B", value: "\u200B", inline: false },
            )
            .setFooter({
                text: "\u200Fأنمي كويز بوت",
            })
            .setTimestamp();

        // Edit the message with the updated embed
        await questionMessage.edit({ embeds: [updatedEmbed] });

        // Stop the countdown when time runs out
        if (answerTime <= 0 || !quizActive || !currentQuestion) {
            clearInterval(countdownInterval);
            countdownInterval = null; // Reset the interval variable

            // Check if the question is still active
            if (currentQuestion) {
                const answerEmbed = new EmbedBuilder()
                    .setTitle("\u200F⏰ انتهى الوقت ⏰")
                    .setDescription(
                        "\u200F" +
                        `الإجابة الصحيحة هي: **${currentQuestion.correctAnswer}**`,
                    )
                    .setColor("#FF0000")
                    .setFooter({
                        text: "\u200Fأنمي كويز بوت",
                    })
                    .setTimestamp();

                await client.channels.cache
                    .get("1343357167528448081")
                    .send({ embeds: [answerEmbed] });

                currentQuestion = null; // Reset the question
            }

            // Schedule the next question after 30 seconds (if the quiz is still active)
            if (quizActive) {
                // Clear any existing timeout
                if (questionTimeout) {
                    clearTimeout(questionTimeout);
                    questionTimeout = null;
                }

                // Schedule the next question
                questionTimeout = setTimeout(postDailyQuestion, 30000); // 30 seconds
            }
        }
    }, 1000); // Update every second
}

// Listen for messages in the chat
client.on("messageCreate", async (message) => {
    if (message.author.bot) return; // Ignore messages from bots
    if (!currentQuestion) return; // Ignore messages if no question is active

    // Check if the user has already answered
    if (answeredUsers.has(message.author.id)) {
        try {
            await message.reply("لقد أجبت بالفعل على هذا السؤال!");
        } catch (error) {
            console.error("Failed to send reply:", error);
        }
        return;
    }

    // Check if the message matches the correct answer
    if (message.content.trim() === currentQuestion.correctAnswer) {
        // Add the user to the answered users set
        answeredUsers.add(message.author.id);

        // Update the user's score
        const userScore = scores.get(message.author.id) || 0;
        scores.set(message.author.id, userScore + 1);

        try {
            // Announce the correct answer
            await message.channel.send(`<@${message.author.id}> أجاب بشكل صحيح! 🎉`);
        } catch (error) {
            console.error("Failed to send announcement:", error);
        }

        // Clear the countdown interval
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        // Reset the question
        currentQuestion = null;

        // Schedule the next question after 30 seconds (if the quiz is still active)
        if (quizActive) {
            // Clear any existing timeout
            if (questionTimeout) {
                clearTimeout(questionTimeout);
                questionTimeout = null;
            }

            // Schedule the next question
            questionTimeout = setTimeout(postDailyQuestion, 30000); // 30 seconds
        }
    }
});
// Start/Stop Quiz Commands
client.on("messageCreate", async (message) => {
    if (message.author.bot) return; // Ignore messages from bots

    // Check if the user has an allowed role
    const hasAllowedRole = allowedRoleIds.some((roleId) =>
        message.member.roles.cache.has(roleId),
    );

    if (!hasAllowedRole) return; // Ignore if the user doesn't have the required role

    // Start Quiz Command
    if (message.content === "!start") {
        if (quizActive) {
            await message.channel.send("الاختبار يعمل بالفعل!");
            return;
        }

        quizActive = true;
        await message.channel.send("تم بدء الاختبار! سيتم نشر الأسئلة الآن.");
        postDailyQuestion(); // Start posting questions
    }
    // Stop Quiz Command
    if (message.content === "!stop") {
        if (!quizActive) {
            await message.channel.send("الاختبار متوقف بالفعل!");
            return;
        }

        quizActive = false;
        currentQuestion = null; // Reset the current question

        // Clear the countdown interval
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        await message.channel.send("تم إيقاف الاختبار. لن يتم نشر المزيد من الأسئلة.");
    }
});

// Leaderboard command
client.on("messageCreate", (message) => {
    if (message.content === "!score") {
        const sortedScores = [...scores.entries()].sort((a, b) => b[1] - a[1]);
        const leaderboard = sortedScores
            .map(
                ([userId, score], index) =>
                    `**${index + 1}.** <@${userId}>: ${score} نقاط`,
            )
            .join("\n");

        const embed = new EmbedBuilder()
            .setTitle("🏆 لوحة المتصدرين 🏆")
            .setDescription(leaderboard || "لا توجد نقاط حتى الآن!")
            .setColor("#00FF00") // Green color
            .setFooter({
                text: "أنمي كويز بوت",
            }) // Updated image URL
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});

client.on("messageCreate", (message) => {
    if (message.content === "!help") {
        const embed = new EmbedBuilder()
            .setTitle("🛠️ مساعدة أنمي كويز بوت 🛠️")
            .setDescription("**مرحبًا! هنا كيفية استخدام البوت:**")
            .setColor("#00BFFF") // Blue color
            .addFields(
                {
                    name: "🎮 **أوامر الاختبار**",
                    value: `
                        - \`!start\`: بدء الاختبار (للمشرفين فقط).
                        - \`!stop\`: إيقاف الاختبار (للمشرفين فقط).
                        - \`!reset\`: إعادة تعيين النقاط (للمشرفين فقط).
                    `,
                    inline: false,
                },
                {
                    name: "⏱️ **قواعد الاختبار**",
                    value: `
                        - اكتب الإجابة الصحيحة في الشات.
                        - لديك **10 ثواني** للإجابة على كل سؤال.
                    `,
                    inline: false,
                },
                {
                    name: "🏆 **أوامر إضافية**",
                    value: `
                        - \`!score\`: عرض لوحة المتصدرين.
                        - \`!help\`: عرض هذه الرسالة.
                    `,
                    inline: false,
                },
            )
            .setFooter({
                text: "أنمي كويز بوت | تمتع باللعبة!",
            })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});

// Admin command to force a reset (using multiple role IDs)
client.on("messageCreate", async (message) => {
    if (message.content === "!reset") {
        // Check if the user has an allowed role
        const hasAllowedRole = allowedRoleIds.some((roleId) =>
            message.member.roles.cache.has(roleId),
        );

        if (hasAllowedRole) {
            // Force post a question

            scores.clear();
            await message.channel.send("تم إعادة تعيين النقاط بنجاح! 🎉");


        }
    }
});

client.login(token);