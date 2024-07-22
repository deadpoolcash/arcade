import numpy as np
import random

# returns (user, house, reserve) diffs
def simulate(multiplier, bet_size, edge, house_p):
    reserve_p = 1 - house_p
    p = 1 / (multiplier + edge)
    if random.random() < p:
        out = (multiplier - 1) * bet_size, 0, (1 - multiplier) * bet_size
#         print('Win! {}'.format(out))
    else:
        out = -bet_size, bet_size * house_p, bet_size * reserve_p
#         print('Lose! {}'.format(out))
    return out


def run_simulations(n = 1000, edge = 0.2, house_p = 0.05):
    user_total = 0
    house_total = 0
    reserve_total = 0
    user_min = 0
    user_max = 0
    house_min = 0
    house_max = 0
    reserve_min = 0
    reserve_max = 0
    for _ in range(n):
        u,h,r = simulate(
            np.random.randint(2, 10),
            np.random.randint(1, 1000),
            edge,
            house_p
        )
        user_total += u
        house_total += h
        reserve_total += r
        if user_total < user_min:
            user_min = user_total
        if user_total > user_max:
            user_max = user_total
        if house_total < house_min:
            house_min = house_total
        if house_total > house_max:
            house_max = house_total
        if reserve_total < reserve_min:
            reserve_min = reserve_total
        if reserve_total > reserve_max:
            reserve_max = reserve_total
    print('edge', edge)
    print('house_p', house_p)
    print('user  ', int(user_total), int(user_min), int(user_max))
    print('house  ', int(house_total), int(house_min), int(house_max))
    print('reserve', int(reserve_total), int(reserve_min), int(reserve_max))

# for _ in range(100):
#     run_simulations(np.random.randint(10, 200))

for i in range(1, 20):
    run_simulations(100000, edge=i / 10, house_p=0.1)

# for house_p in range(1, 6):
#     for edge in range(20, 51, 5):
#         run_simulations(1000000, edge=edge / 100, house_p=house_p / 100)