import { defineStore } from 'pinia';
import { Auth } from "aws-amplify";
import axios from 'axios';

export const useChannelStore = defineStore('channelStore', {
    state: () => ({
        channels: [],
        loading: false,
    }),

    actions: {
        async getChannelNames(user) {
            this.loading = true;
            try {
                const data = await $fetch(`/api/message/listings/channels/${user}`);

                this.channels = data;
            } catch (error) {
                console.error('Error getting channels:', error.message);
            } finally {
                this.loading = false;
            }
        },
        async addChannel(channelProps) {

            try {
                const res = await fetch('/api/message/listings/channels', {
                    method: 'POST',
                    body: JSON.stringify(channelProps),
                    headers: { 'Content-Type': 'application/json' },
                });

                if (res.ok) {
                    const addedChannel = await res.json();
                    console.log(channelProps)

                    this.channels.push(channelProps);

                } else {
                    const errorData = await res.json();
                    console.error('Error adding channel:', errorData);
                }
            } catch (error) {
                console.error('An error occurred while adding a channel:', error.message);
            }
        },
        async addLink(linkProps) {
            if (
                linkProps &&
                (linkProps.linkName.includes("shesfreaky.com") ||
                    linkProps.linkName.includes("xnxx.com") ||
                    linkProps.linkName.includes("xvideos.com") ||
                    linkProps.linkName.includes("instagram.com"))
            ) {
                try {
                    const res = await axios.post('https://31fe-76-185-22-161.ngrok-free.app/upload', linkProps, {
                        headers: { 'Content-Type': 'application/json' },
                    });
                    console.log(res)

                    if (res.status === 200) {
                        const addedLink = res.data;
                        console.log(addedLink);
                    } else {
                        console.error('Error adding link:', res.data);
                    }
                } catch (error) {
                    console.error('An error occurred while adding a link:', error.message);
                }
            }
        },

        async deleteChannel(channelName) {
            try {
                this.channels = this.channels.filter((channel) => channel.channelName !== channelName);

                const user = await Auth.currentAuthenticatedUser();


                const res = await fetch(`/api/message/channels/${channelName}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username: user.username }),
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    console.error('Error deleting channel:', errorData);
                } else {

                }
            } catch (error) {
                console.error('An error occurred while deleting a channel:', error.message);
            }
        },
        async subscribeToChannel(subscriptionData) {
            try {
                const res = await fetch(`/api/message/listings/subscribe`, {
                    method: 'POST',
                    body: JSON.stringify(subscriptionData),
                    headers: { 'Content-Type': 'application/json' },
                });

                if (res.ok) {
                    const subscribeChannel = await res.json();


                } else {
                    const errorData = await res.json();
                    console.error('Error subscribing to  channel:', errorData);
                }
            } catch (error) {
                console.error('An error occurred while subscribing to a channel:', error.message);
            }
        },
        async inviteToChannel(subscriptionData) {
            try {
                const res = await fetch(`/api/message/listings/invite`, {
                    method: 'POST',
                    body: JSON.stringify(subscriptionData),
                    headers: { 'Content-Type': 'application/json' },
                });

                if (res.ok) {
                    const subscribeChannel = await res.json();


                } else {
                    const errorData = await res.json();
                    console.error('Error subscribing to  channel:', errorData);
                }
            } catch (error) {
                console.error('An error occurred while subscribing to a channel:', error.message);
            }
        },
    },

    getters: {
        getChannels: (state) => {
            return state.channels;
        },
    },
});
