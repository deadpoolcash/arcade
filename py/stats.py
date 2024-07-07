import numpy as np
import random
edge = 0.01



def simulate(multiplier, bet_size):
    p = (1 - edge) / (multiplier + 1)
    if random.random() < p:
        out =  (multiplier - 1) * bet_size
        print('Win! {}'.format(out))
    else:
        out = -bet_size
        print('Lose! {}'.format(out))
    return out


def run_simulations(n = 1000):
    runs = [
        simulate(np.random.randint(2, 100), np.random.randint(1, 1000))
        for _ in range(n)
    ]
    total = sum(runs)
    print(total)


run_simulations(100)