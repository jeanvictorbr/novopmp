const { UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');

const enlistmentHandler = {
    customId: (id) => id.startsWith('enlistment_'),
    
    async execute(interaction) {
        const { customId } = interaction;
        try {
            if (customId === 'enlistment_start') return await this.showEnlistmentModal(interaction);
            if (customId === 'enlistment_modal') return await this.handleEnlistmentModal(interaction);
            if (customId.startsWith('enlistment_recruiter_select')) return await this.handleRecruiterSelect(interaction);
            if (customId.startsWith('enlistment_approve')) return await this.handleApproval(interaction, true);
            if (customId.startsWith('enlistment_reject')) return await this.handleApproval(interaction, false);
        } catch (error) {
            console.error(`Erro no handler de alistamento (${customId}):`, error);
        }
    },

    async showEnlistmentModal(interaction) {
        const modal = new ModalBuilder().setCustomId('enlistment_modal').setTitle('Formulário de Alistamento');
        const nameInput = new TextInputBuilder().setCustomId('enlist_rp_name').setLabel("Nome Completo (no RP)").setStyle(TextInputStyle.Short).setRequired(true);
        const idInput = new TextInputBuilder().setCustomId('enlist_game_id').setLabel("Seu ID (no jogo)").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(idInput));
        await interaction.showModal(modal);
    },

    async handleEnlistmentModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const rpName = interaction.fields.getTextInputValue('enlist_rp_name');
        const gameId = interaction.fields.getTextInputValue('enlist_game_id');
        
        const recruiterRoleId = (await db.get("SELECT value FROM settings WHERE key = 'recruiter_role_id'"))?.value;
        if (!recruiterRoleId) return await interaction.editReply('❌ O cargo de recrutador não foi configurado.');
        
        const recruiters = await interaction.guild.members.fetch({ withPresences: true });
        const onlineRecruiters = recruiters.filter(m => m.roles.cache.has(recruiterRoleId) && m.presence?.status === 'online');
        
        if (onlineRecruiters.size === 0) return await interaction.editReply('❌ Nenhum recrutador online no momento. Tente novamente mais tarde.');

        const menu = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId(`enlistment_recruiter_select_${interaction.user.id}`)
                .setPlaceholder('Selecione um recrutador online...')
                .setDefaultUsers(onlineRecruiters.map(m => m.id))
        );
        
        // Salva os dados temporariamente
        interaction.client.tempData = interaction.client.tempData || new Map();
        interaction.client.tempData.set(interaction.user.id, { rpName, gameId });

        await interaction.editReply({ content: 'Ótimo! Agora, selecione um dos recrutadores online abaixo para avaliar a sua ficha.', components: [menu] });
    },

    async handleRecruiterSelect(interaction) {
        await interaction.deferUpdate();
        const tempData = interaction.client.tempData.get(interaction.user.id);
        if (!tempData) return interaction.editReply({ content: '❌ Ocorreu um erro, seus dados não foram encontrados. Por favor, tente novamente.', components: [] });

        const recruiterId = interaction.values[0];
        const { rpName, gameId } = tempData;
        
        const result = await db.run('INSERT INTO enlistment_requests (user_id, rp_name, game_id, recruiter_id, request_date) VALUES ($1, $2, $3, $4, $5) RETURNING request_id', [interaction.user.id, rpName, gameId, recruiterId, Math.floor(Date.now() / 1000)]);
        const requestId = result.rows[0].request_id;
        
        const approvalChannelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_approval_channel_id'"))?.value;
        if (!approvalChannelId) return;

        const channel = await interaction.guild.channels.fetch(approvalChannelId);
        const embed = new EmbedBuilder()
            .setColor('Yellow').setTitle('📝 Novo Pedido de Alistamento')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .addFields(
                { name: 'Candidato', value: interaction.user.toString(), inline: true },
                { name: 'Recrutador Designado', value: `<@${recruiterId}>`, inline: true },
                { name: 'Nome (RP)', value: `\`${rpName}\`` },
                { name: 'ID (Jogo)', value: `\`${gameId}\`` }
            );

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`enlistment_approve_${requestId}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`enlistment_reject_${requestId}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
        );
        
        await channel.send({ content: `Atenção, <@${recruiterId}>!`, embeds: [embed], components: [buttons] });
        interaction.client.tempData.delete(interaction.user.id);
        await interaction.editReply({ content: '✅ Seu pedido de alistamento foi enviado para análise! Você será notificado por DM sobre o resultado.', components: [] });
    },

    async handleApproval(interaction, isApproved) {
        await interaction.deferUpdate();
        const requestId = interaction.customId.split('_').pop();
        const request = await db.get('SELECT * FROM enlistment_requests WHERE request_id = $1', [requestId]);
        
        if (!request || request.status !== 'pending') return;

        const newStatus = isApproved ? 'approved' : 'rejected';
        await db.run('UPDATE enlistment_requests SET status = $1 WHERE request_id = $2', [newStatus, requestId]);

        const candidate = await interaction.guild.members.fetch(request.user_id).catch(() => null);
        const embedColor = isApproved ? 'Green' : 'Red';
        const embedTitle = isApproved ? '🎉 Alistamento Aprovado!' : '❌ Alistamento Recusado';
        let embedDescription = isApproved 
            ? 'Parabéns! O seu pedido de alistamento foi aprovado. Apresente-se no local designado para iniciar o seu treinamento.'
            : 'O seu pedido de alistamento foi recusado. Você pode tentar novamente no futuro.';

        // LÓGICA ADICIONADA AQUI
        if (isApproved && candidate) {
            const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;
            if (recruitRoleId) {
                try {
                    const role = await interaction.guild.roles.fetch(recruitRoleId);
                    if (role) {
                        await candidate.roles.add(role);
                        embedDescription += `\n\nVocê recebeu o cargo **${role.name}**.`;
                    }
                } catch (err) {
                    console.error("Erro ao dar cargo de alistado:", err);
                    interaction.followUp({ content: `⚠️ Não foi possível entregar o cargo de alistado para ${candidate.toString()}. Verifique minhas permissões.`, ephemeral: true });
                }
            }
        }
        
        if (candidate) {
            try {
                const dmEmbed = new EmbedBuilder().setColor(embedColor).setTitle(embedTitle).setDescription(embedDescription).setFooter({ text: `Analisado por: ${interaction.user.tag}` });
                await candidate.send({ embeds: [dmEmbed] });
            } catch (e) {}
        }
        
        const originalEmbed = new EmbedBuilder(interaction.message.embeds[0].toJSON())
            .setColor(embedColor)
            .setTitle(`Pedido de Alistamento ${isApproved ? 'Aprovado' : 'Recusado'}`)
            .setFooter({ text: `Decisão de ${interaction.user.tag}` });
        
        await interaction.editReply({ embeds: [originalEmbed], components: [] });
    }
};

module.exports = enlistmentHandler;