const { StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('promote_select_'),
    async execute(interaction) {
        // Separa a lógica para cada etapa do fluxo
        const parts = interaction.customId.split('_');
        const step = parts[2];
        
        // Etapa 2: O admin selecionou o OFICIAL. Agora, mostramos o menu para selecionar o NOVO CARGO.
        if (step === 'user') {
            await interaction.deferUpdate(); // Apenas acusa o recebimento da seleção do usuário

            const userId = interaction.values[0];
            const member = await interaction.guild.members.fetch(userId);

            const allCareerRoles = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
            const allCareerRoleIds = new Set([...allCareerRoles.map(r => r.role_id), ...allCareerRoles.map(r => r.previous_role_id).filter(Boolean)]);

            const memberHighestRole = member.roles.cache
                .filter(role => allCareerRoleIds.has(role.id))
                .sort((a, b) => b.position - a.position)
                .first();

            const promotableRoleIds = [];
            if (!memberHighestRole) {
                interaction.guild.roles.cache
                    .filter(role => allCareerRoleIds.has(role.id))
                    .sort((a, b) => a.position - b.position)
                    .forEach(role => promotableRoleIds.push(role.id));
            } else {
                let currentIdInChain = memberHighestRole.id;
                const visited = new Set(); 
                while (currentIdInChain && !visited.has(currentIdInChain)) {
                    visited.add(currentIdInChain);
                    const nextStep = allCareerRoles.find(r => r.previous_role_id === currentIdInChain);
                    if (nextStep) {
                        promotableRoleIds.push(nextStep.role_id);
                        currentIdInChain = nextStep.role_id;
                    } else {
                        currentIdInChain = null;
                    }
                }
            }
            
            if (promotableRoleIds.length === 0) {
                return await interaction.editReply({ content: '❌ Este oficial já está no cargo mais alto da carreira ou não há promoções configuradas para ele.', components: [] });
            }

            const roleOptions = promotableRoleIds
                .map(id => interaction.guild.roles.cache.get(id))
                .filter(Boolean)
                .map(role => ({
                    label: role.name,
                    value: role.id,
                }));

            const nextRole = roleOptions.length > 0 ? interaction.guild.roles.cache.get(roleOptions[0].value) : null;
            let contentMessage;
            let placeholder = 'Selecione o novo cargo...';

            if (memberHighestRole && nextRole) {
                contentMessage = `***O oficial que vc selecionou, possui o cargo ${memberHighestRole.toString()}. De acordo com o sistema, a sua próxima patente é ${nextRole.toString()}.\n\nSelecione abaixo o cargo desejado (é possível pular patentes).***`;
                placeholder = `Sugestão: Promover para ${nextRole.name}`;
            } else if (memberHighestRole) {
                contentMessage = `***O oficial possui o cargo ${memberHighestRole.toString()}, mas não há promoções futuras configuradas para esta patente.***`;
            } else {
                contentMessage = `***O oficial não possui um cargo de carreira. Selecione o cargo de ingresso na lista abaixo.***`;
            }

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`promote_select_newrole_${userId}`)
                    .setPlaceholder(placeholder)
                    .addOptions(roleOptions.slice(0, 25))
            );

            await interaction.editReply({ content: contentMessage, components: [menu] });
        }
        
        // Etapa 3: O admin selecionou o NOVO CARGO. Agora, abrimos o MODAL para a justificativa.
        if (step === 'newrole') {
            // Nesta etapa, a interação é a seleção do menu. A primeira resposta é abrir o modal.
            // Não usamos deferUpdate() aqui.

            const userId = parts[3];
            const newRoleId = interaction.values[0];
            
            const modal = new ModalBuilder()
                .setCustomId(`promote_modal_${userId}_${newRoleId}`)
                .setTitle('Justificativa da Promoção');
                
            const reasonInput = new TextInputBuilder()
                .setCustomId('promotion_reason')
                .setLabel("Motivo da Promoção")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Descreva os méritos e a razão pela qual o oficial está sendo promovido.")
                .setRequired(true);
                
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            
            // A única resposta para esta interação é mostrar o modal.
            await interaction.showModal(modal);
        }
    }
};