const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const db = require('../../../database/db.js');
const { getAcademyMenuPayload } = require('../../../views/setup_views.js');
const { logAcademyAction } = require('../../../utils/academy/logUtils.js');

module.exports = {
  customId: 'academy_add_course_modal',
  async execute(interaction) {
    // CORREÇÃO: Usando ephemeral: true para evitar o erro.
    await interaction.deferReply({ ephemeral: true });

    let newRole = null;
    let thread = null;
    try {
      const courseId = interaction.fields.getTextInputValue('course_id').toUpperCase().trim();
      const courseName = interaction.fields.getTextInputValue('course_name');
      const description = interaction.fields.getTextInputValue('course_description');
      const requiredHoursInput = interaction.fields.getTextInputValue('required_hours');
      const requiredHours = requiredHoursInput ? parseInt(requiredHoursInput) : 0;

      if (!courseId) {
        return await interaction.editReply('❌ O ID do curso não pode ser vazio.');
      }
      
      if (isNaN(requiredHours) || requiredHours < 0) {
        return await interaction.editReply('❌ O número de horas mínimas deve ser um número inteiro positivo.');
      }
      
      if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return await interaction.editReply('❌ O bot não tem a permissão "Gerenciar Cargos".');
      }
      newRole = await interaction.guild.roles.create({
          name: courseName,
          color: 'Blue',
          reason: `Cargo criado para o curso: ${courseName}.`,
      });

      const discussionChannelId = (await db.get("SELECT value FROM settings WHERE key = 'academy_discussion_channel_id'"))?.value;
      if (!discussionChannelId) {
          return await interaction.editReply('❌ O canal de discussões não foi configurado.');
      }
      const discussionChannel = await interaction.guild.channels.fetch(discussionChannelId).catch(() => null);
      if (!discussionChannel || !discussionChannel.isTextBased()) {
          return await interaction.editReply('❌ O canal de discussões configurado não é válido.');
      }
      if (!discussionChannel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.ManageThreads)) {
          return await interaction.editReply('❌ O bot não tem a permissão "Gerenciar Tópicos" no canal de discussões.');
      }
      thread = await discussionChannel.threads.create({
          name: `🎓-curso-${courseName.toLowerCase().replace(/ /g, '-')}`,
          reason: `Discussão para o curso: ${courseName}`,
          autoArchiveDuration: 60,
      });

      await db.run(
        'INSERT INTO academy_courses (course_id, name, description, required_hours, role_id, thread_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [courseId, courseName, description, requiredHours, newRole.id, thread.id]
      );

      await interaction.editReply(`✅ Curso **${courseName}** adicionado com sucesso! Discussão criada em ${thread}.`);
      
      const updatedMenu = await getAcademyMenuPayload(db);
      await interaction.message.edit(updatedMenu).catch(console.error);

    } catch (error) {
      console.error("Erro ao adicionar curso:", error);
      if (error.code === '23505') {
        await interaction.editReply('❌ O ID do curso já existe. Por favor, use um ID diferente.');
      } else {
        await interaction.editReply('❌ Ocorreu um erro ao adicionar o curso.');
      }
    }
  },
};