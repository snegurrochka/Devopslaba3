const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = '7010908674:AAEfdAoeyD4BNy51-YA1FwliyAE5jy3ly6o';
const bot = new TelegramBot(token, { polling: true });

const coachId = '640624667';
let clients = [];
let services;

try {
  services = JSON.parse(fs.readFileSync('services.json'));
} catch (error) {
  console.error('Error reading services.json:', error);
  process.exit(1);
}

const servicesMenu = {
  reply_markup: {
    keyboard: [
      [{ text: services.meal_plan.description }],
      [{ text: services.nutrition_management.description }],
      [{ text: services.online_workouts.description }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

const paymentMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Оплатити' }],
      [{ text: 'Скасувати' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

const homeOrGymMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Тренування вдома' }],
      [{ text: 'Тренування в залі' }],
      [{ text: 'Скасувати' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

const readyMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Готово' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

const returnMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Повернутися до меню' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

const coachMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Посмотреть клиентов' }],
      [{ text: 'Подтвердить оплату' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId == coachId) {
    bot.sendMessage(chatId, 'Здравствуйте, тренер! Что вы хотите сделать?', coachMenu);
  } else {
    bot.sendMessage(chatId, 'Добрий день! Оберіть послугу:', servicesMenu);
  }
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text.startsWith('/start')) return;
  if (chatId == coachId) {
    handleCoachMessage(msg);
  } else {
    handleClientMessage(msg);
  }
});

function handleCoachMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;

  switch (text) {
    case 'Посмотреть клиентов':
      let awaitingClients = clients.filter(client => client.status === 'awaiting_confirmation');
      if (awaitingClients.length === 0) {
        bot.sendMessage(chatId, 'Нет ожидающих клиентов.', { reply_markup: coachMenu.reply_markup });
      } else {
        awaitingClients.forEach(client => {
          const username = client.username ? `@${client.username}` : client.name;
          const contactLink = client.username ? `@${client.username}` : `[ссылка на клиента](tg://user?id=${client.id})`;
          let serviceDescription = services[client.service].description;
          
          if (client.service === 'online_workouts' && client.workoutType) {
            const workoutType = client.workoutType === 'home' ? 'Тренування вдома' : 'Тренування в залі';
            serviceDescription += ` (${workoutType})`;
          }

          const clientInfo = `Клиент: ${username}\nУслуга: ${serviceDescription}\nСвязаться: ${contactLink}`;
          bot.sendMessage(chatId, clientInfo, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: `Написать ${client.name}`, url: `tg://user?id=${client.id}` }]
              ]
            }
          });
        });
        bot.sendMessage(chatId, 'Что вы хотите сделать дальше?', { reply_markup: coachMenu.reply_markup });
      }
      break;
    case 'Подтвердить оплату':
      let confirmClients = clients.filter(client => client.status === 'awaiting_confirmation');
      if (confirmClients.length === 0) {
        bot.sendMessage(chatId, 'Нет ожидающих клиентов.', { reply_markup: coachMenu.reply_markup });
      } else {
        let confirmMenu = {
          reply_markup: {
            keyboard: confirmClients.map(client => [{ text: `Подтвердить ${client.name}` }]),
            resize_keyboard: true,
            one_time_keyboard: true
          }
        };
        bot.sendMessage(chatId, 'Выберите клиента для подтверждения оплаты:', confirmMenu);
      }
      break;
    default:
      if (msg.text.startsWith('Подтвердить')) {
        let clientName = msg.text.replace('Подтвердить ', '');
        let client = clients.find(c => c.name === clientName && c.status === 'awaiting_confirmation');
        if (client) {
          bot.sendMessage(client.id, 'Ваша оплата підтверджена!\nБудь ласка, заповніть анкету: ' + services[client.service].form_link, readyMenu);
          client.status = 'payment_confirmed';
          bot.sendMessage(chatId, `Оплата клиента ${clientName} подтверждена.`, { reply_markup: coachMenu.reply_markup });
        } else {
          bot.sendMessage(chatId, 'Клиент не найден или уже подтвержден.', { reply_markup: coachMenu.reply_markup });
        }
      } else {
        bot.sendMessage(chatId, 'Пожалуйста, выберите действие из меню.', { reply_markup: coachMenu.reply_markup });
      }
  }
}


// Обновите функцию handleClientMessage
function handleClientMessage(msg) {
  const chatId = msg.chat.id;
  let client = clients.find(c => c.id === chatId);

  if (!client) {
    client = { id: chatId, name: msg.from.first_name, purchasedServices: [] };
    clients.push(client);
  }

  if (client && client.status === 'awaiting_confirmation') {
    bot.sendMessage(chatId, services[client.service].payment_message);
  } else {
    switch (msg.text) {
      case 'Повернутися до меню':
        bot.sendMessage(chatId, 'Добрий день! Оберіть послугу:', servicesMenu);
        break;
      case services.meal_plan.description:
        if (client.purchasedServices.includes('meal_plan')) {
          bot.sendMessage(chatId, 'Ви вже купили цю послугу. Оберіть іншу послугу.', servicesMenu);
        } else {
          client.service = 'meal_plan';
          client.status = 'awaiting_payment';
          bot.sendMessage(chatId, services.meal_plan.instructions, paymentMenu);
        }
        break;
      case services.nutrition_management.description:
        if (client.purchasedServices.includes('nutrition_management')) {
          bot.sendMessage(chatId, 'Ви вже купили цю послугу. Оберіть іншу послугу.', servicesMenu);
        } else {
          client.service = 'nutrition_management';
          client.status = 'awaiting_payment';
          bot.sendMessage(chatId, services.nutrition_management.instructions, paymentMenu);
        }
        break;
      case services.online_workouts.description:
        if (client.purchasedServices.includes('online_workouts')) {
          bot.sendMessage(chatId, 'Ви вже купили цю послугу. Оберіть іншу послугу.', servicesMenu);
        } else {
          client.service = 'online_workouts';
          client.status = 'awaiting_workout_type';
          bot.sendMessage(chatId, 'Оберіть тип тренування:', homeOrGymMenu);
        }
        break;
      case 'Тренування вдома':
      case 'Тренування в залі':
        if (client && client.status === 'awaiting_workout_type') {
          client.workoutType = msg.text === 'Тренування вдома' ? 'home' : 'gym';
          client.status = 'awaiting_payment';
          const instructions = client.workoutType === 'home'
            ? services.online_workouts.home_instructions
            : services.online_workouts.gym_instructions.join('\n\n');
          bot.sendMessage(chatId, instructions, paymentMenu);
        }
        break;
      case 'Скасувати':
        if (client && client.status !== 'awaiting_confirmation') {
          clients = clients.filter(c => c.id !== chatId);
          bot.sendMessage(chatId, 'Ви повернулися до вибору послуг:', servicesMenu);
        }
        break;
      case 'Оплатити':
        if (client && client.status === 'awaiting_payment') {
          bot.sendMessage(chatId, services[client.service].payment_message, { reply_markup: { remove_keyboard: true } });
          client.status = 'awaiting_confirmation';

          // Отправка уведомления тренеру
          const username = client.username ? `@${client.username}` : client.name;
          const contactLink = client.username ? `@${client.username}` : `[ссылка на клиента](tg://user?id=${client.id})`;
          let serviceDescription = services[client.service].description;

          if (client.service === 'online_workouts' && client.workoutType) {
            const workoutType = client.workoutType === 'home' ? 'Тренування вдома' : 'Тренування в залі';
            serviceDescription += ` (${workoutType})`;
          }

          const clientInfo = `Клиент: ${username}\nУслуга: ${serviceDescription}\nСвязаться: ${contactLink}`;
          bot.sendMessage(coachId, `Новый клиент ожидает подтверждения оплаты:\n\n${clientInfo}`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: `Написать ${client.name}`, url: `tg://user?id=${client.id}` }]
              ]
            }
          });
        }
        break;
      default:
        handleClientPostPayment(msg, client, chatId);
    }
  }
}


function handleClientPostPayment(msg, client, chatId) {
  if (!client) {
    return;
  }
  switch (client.service) {
    case 'meal_plan':
      handleMealPlanPostPayment(msg, client, chatId);
      break;
    case 'nutrition_management':
      handleNutritionManagementPostPayment(msg, client, chatId);
      break;
    case 'online_workouts':
      handleOnlineWorkoutsPostPayment(msg, client, chatId);
      break;
    default:
      bot.sendMessage(chatId, 'Невідома послуга.');
  }
}

function handleMealPlanPostPayment(msg, client, chatId) {
  switch (msg.text) {
    case 'Готово':
      if (client.status === 'payment_confirmed') {
        bot.sendMessage(chatId, services.meal_plan.waiting_message, returnMenu);
        client.status = 'completed';
        if (!client.purchasedServices.includes('meal_plan')) {
          client.purchasedServices.push('meal_plan');
        }
      } else {
        bot.sendMessage(chatId, services.meal_plan.waiting_message, returnMenu);
      }
      break;
    default:
      bot.sendMessage(chatId, services.meal_plan.waiting_message, returnMenu);
  }
}

async function handleNutritionManagementPostPayment(msg, client, chatId) {
  switch (msg.text) {
    case 'Готово':
      if (client.status === 'payment_confirmed') {
        if (!client.infoSent) {
          // Надсилаємо інформацію з першого масиву
          if (services.nutrition_management.information) {
            for (const info of services.nutrition_management.information) {
              await bot.sendMessage(chatId, info);
            }
          }
          client.infoSent = true;
          bot.sendMessage(chatId, 'Натисніть "Готово", щоб отримати інструкції', readyMenu);
        } else if (!client.secondInfoSent) {
          // Надсилаємо інформацію з другого масиву
          if (services.nutrition_management.second_information) {
            for (const info of services.nutrition_management.second_information) {
              await bot.sendMessage(chatId, info);
            }
          }
          client.secondInfoSent = true;
          bot.sendMessage(chatId, 'Натисніть "Готово", коли відправите тренеру фото', readyMenu);
        } else {
          // Завершуємо процес
          bot.sendMessage(chatId, 'Очікуйте подальших дій від тренера', returnMenu);
          client.status = 'completed';
          if (!client.purchasedServices.includes('nutrition_management')) {
            client.purchasedServices.push('nutrition_management');
          }
        }
      } else {
        bot.sendMessage(chatId, 'Очікуйте подальших дій від тренера', returnMenu);
      }
      break;
    default:
      bot.sendMessage(chatId, 'Очікуйте подальших дій від тренера', returnMenu);
  }
}




function handleOnlineWorkoutsPostPayment(msg, client, chatId) {
  switch (msg.text) {
    case 'Готово':
      if (client.status === 'payment_confirmed') {
        bot.sendMessage(chatId, services.online_workouts.waiting_message, returnMenu);
        client.status = 'completed';
        if (!client.purchasedServices.includes('online_workouts')) {
          client.purchasedServices.push('online_workouts');
        }
      } else {
        bot.sendMessage(chatId, services.online_workouts.waiting_message, returnMenu);
      }
      break;
    default:
      bot.sendMessage(chatId, services.online_workouts.waiting_message, returnMenu);
  }
}

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const clientId = query.data.replace('contact_', '');

  const client = clients.find(c => c.id == clientId);
  if (client) {
    bot.sendMessage(chatId, `Написать клиенту ${client.name}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `@${client.username || client.name}`, url: `tg://user?id=${client.id}` }]
        ]
      }
    });
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});
