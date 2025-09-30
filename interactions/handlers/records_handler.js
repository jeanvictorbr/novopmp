const { UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { getRecordsMenuPayload } = require('../../views/setup_views.js');

// Função auxiliar para converter data DD/MM/AAAA para timestamp
function dateToTimestamp(dateString) {
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    const date = new Date(+parts[2], parts[1] - 1, +parts[0]);
    return Math.floor(date.getTime() / 1000);
}

const recordsHandler = {
    customId: (id) => id.startsWith('records_'),
    
    async execute(interaction) {
        const { customId } = interaction;

        try {
            // Ações do Painel de Setup
            if (customId === 'records_create_edit') return await this.showUserSelect(interaction);
            if (customId === 'records_user_select') return await this.showRecordModal(interaction);
            if (customId.startsWith('records_save_modal')) return await this.handleSaveRecord(interaction);

            // Ações do Painel Público
            if (customId === 'records_public_lookup') return await this.showLookupModal(interaction);
            if (customId === 'records_lookup_modal') return await this.handleLookup(interaction);

        } catch (error) {
            console.error(`Erro no handler de registros (${customId}):`, error);
        }
    },

    // --- Funções do Setup ---
    async showUserSelect(interaction) {
        const menu = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('records_user_select').setPlaceholder('Selecione um oficial...'));
        await interaction.reply({ content: 'Selecione o oficial para criar ou editar o registro.', components: [menu], ephemeral: true });
    },

    async showRecordModal(interaction) {
        const targetUserId = interaction.values[0];
        const targetUser = await interaction.guild.members.fetch(targetUserId);
        const existingRecord = await db.get('SELECT * FROM officer_records WHERE user_id = $1', [targetUserId]);
        
        const modal = new ModalBuilder().setCustomId(`records_save_modal_${targetUserId}`).setTitle(`Registro de ${targetUser.user.username}`);
        const badgeInput = new TextInputBuilder().setCustomId('record_badge').setLabel("Nº de Distintivo").setStyle(TextInputStyle.Short).setRequired(true);
        const nameInput = new TextInputBuilder().setCustomId('record_fullname').setLabel("Nome Completo (RP)").setStyle(TextInputStyle.Short).setRequired(true);
        const entryDateInput = new TextInputBuilder().setCustomId('record_entrydate').setLabel("Data de Ingresso (DD/MM/AAAA)").setStyle(TextInputStyle.Short).setRequired(true);
        const statusInput = new TextInputBuilder().setCustomId('record_status').setLabel("Status Atual").setStyle(TextInputStyle.Short).setRequired(true);
        const bioInput = new TextInputBuilder().setCustomId('record_bio').setLabel("Biografia / Anotações").setStyle(TextInputStyle.Paragraph).setRequired(false);

        if (existingRecord) {
            badgeInput.setValue(existingRecord.badge_number || '');
            nameInput.setValue(existingRecord.full_name || '');
            entryDateInput.setValue(new Date(existingRecord.entry_date * 1000).toLocaleDateString('pt-BR'));
            statusInput.setValue(existingRecord.status || 'Ativo');
            bioInput.setValue(existingRecord.bio || '');
        } else {
            statusInput.setValue('Ativo');
        }

        modal.addComponents(new ActionRowBuilder().addComponents(badgeInput), new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(entryDateInput), new ActionRowBuilder().addComponents(statusInput), new ActionRowBuilder().addComponents(bioInput));
        await interaction.showModal(modal);
    },

    async handleSaveRecord(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const targetUserId = interaction.customId.split('_').pop();
        const badgeNumber = interaction.fields.getTextInputValue('record_badge');
        const fullName = interaction.fields.getTextInputValue('record_fullname');
        const entryDateStr = interaction.fields.getTextInputValue('record_entrydate');
        const status = interaction.fields.getTextInputValue('record_status');
        const bio = interaction.fields.getTextInputValue('record_bio');
        const entryTimestamp = dateToTimestamp(entryDateStr);
        if (!entryTimestamp) return await interaction.editReply({ content: '❌ Data inválida. Use o formato DD/MM/AAAA.' });

        await db.run(`INSERT INTO officer_records (user_id, badge_number, full_name, entry_date, status, bio) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id) DO UPDATE SET badge_number = $2, full_name = $3, entry_date = $4, status = $5, bio = $6`, [targetUserId, badgeNumber, fullName, entryTimestamp, status, bio]);
        await interaction.editReply('✅ Registro do oficial salvo com sucesso!');
    },

    // --- Funções Públicas ---
    async showLookupModal(interaction) {
        const modal = new ModalBuilder().setCustomId('records_lookup_modal').setTitle('Consultar Registro de Oficial');
        const badgeInput = new TextInputBuilder().setCustomId('lookup_badge').setLabel("Número do Distintivo").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Digite o número do distintivo a ser consultado.');
        modal.addComponents(new ActionRowBuilder().addComponents(badgeInput));
        await interaction.showModal(modal);
    },

    async handleLookup(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const badgeNumber = interaction.fields.getTextInputValue('lookup_badge');
        const record = await db.get('SELECT * FROM officer_records WHERE badge_number = $1', [badgeNumber]);

        if (!record) {
            return await interaction.editReply(`❌ Nenhum oficial encontrado com o distintivo nº \`${badgeNumber}\`.`);
        }
        
        const targetUser = await interaction.guild.members.fetch(record.user_id).catch(() => null);
        const embed = new EmbedBuilder()
            .setColor('Green').setTitle(`Ficha do Oficial: ${record.full_name}`)
            .setThumbnail(targetUser ? targetUser.user.displayAvatarURL() : interaction.guild.iconURL())
            .addFields(
                { name: 'Nº Distintivo', value: `\`${record.badge_number}\``, inline: true },
                { name: 'Status', value: `\`${record.status}\``, inline: true },
                { name: 'Ingresso na Corporação', value: `<t:${record.entry_date}:D>` }
            );
        await interaction.editReply({ embeds: [embed] });
    }
};

module.exports = recordsHandler;